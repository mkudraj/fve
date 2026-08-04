/**
 * Investigation orchestrator.
 *
 * Coordinates the pre-accept / post-accept requests to the official FACEIT
 * Data API, persists sanitized fixtures, keeps matchId state, and computes the
 * final verdict (YES / NO / INCONCLUSIVE).
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fetchMatchData } from "../faceit/data-api-client.js";
import { sanitizeResponseBody } from "../security/sanitize.js";
import { analyzeRosterFromJson } from "./roster.js";
import { diffPrePost } from "./diff.js";
import type {
  DataApiRecord,
  InternalMatchRecord,
  InvestigationAnswer,
  MatchIdDetection,
} from "../types/index.js";

export interface InvestigationContext {
  sessionDir: string;
}

export class Investigation {
  matchId: string | null = null;
  matchIdDetectedAt: string | null = null;
  matchIdSource: string | null = null;
  private dataApi: DataApiRecord[] = [];
  private internal: InternalMatchRecord[] = [];
  private internalCaptured: string | null = null;

  constructor(private ctx: InvestigationContext) {
    mkdirSync(join(ctx.sessionDir, "data-api"), { recursive: true });
    mkdirSync(join(ctx.sessionDir, "internal-api"), { recursive: true });
    mkdirSync(join(ctx.sessionDir, "diff"), { recursive: true });
  }

  /** Record that a matchId was seen. Avoids duplicate work. */
  handleDetection(detection: MatchIdDetection): boolean {
    if (!this.matchId) {
      this.matchId = detection.matchId;
      this.matchIdDetectedAt = detection.timestamp;
      this.matchIdSource = detection.source;
      this.persistMatchId();
      return true; // new detection
    }
    return false;
  }

  private persistMatchId() {
    const payload = {
      matchId: this.matchId,
      detectedAt: this.matchIdDetectedAt,
      source: this.matchIdSource,
    };
    writeFileSync(join(this.ctx.sessionDir, "match-id.json"), JSON.stringify(payload, null, 2));
  }

  /** Capture the internal (browser-driven) match endpoint body. */
  handleInternalBody(body: string, phase: "pre_accept" | "post_accept") {
    if (!this.matchId) return;
    // First capture wins for the given phase (keep earliest).
    const exists = this.internal.some((r) => r.phase === phase);
    if (exists) return;
    const record: InternalMatchRecord = {
      matchId: this.matchId,
      phase,
      timestamp: new Date().toISOString(),
      sanitizedBody: body,
    };
    this.internal.push(record);
    const file = phase === "pre_accept" ? "pre-accept.json" : "post-accept.json";
    writeFileSync(join(this.ctx.sessionDir, "internal-api", file), JSON.stringify(record, null, 2));
  }

  /** Run the PRE_ACCEPT Data API probes (with bounded retries on 404). */
  async runPreAcceptChecks(): Promise<void> {
    if (!this.matchId) return;
    const probeDelays = [0, 500, 1500];
    for (const delay of probeDelays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const result = await fetchMatchData(this.matchId, "pre_accept", {
        sanitizeBody: (b) => sanitizeResponseBody(b),
      });
      const status = result.httpStatus;
      this.dataApi.push(result);
      this.persistDataApi();
      if (status === 200) break;       // got it, stop probing
      if (status === 401 || status === 403 || status === 429) break; // auth/rate-limit, retry pointless
      // 404 or others: try up to 2 more times
    }
  }

  /** Run the POST_ACCEPT Data API checks (immediate + delayed). */
  async runPostAcceptChecks(): Promise<void> {
    if (!this.matchId) return;

    const immediate = await fetchMatchData(this.matchId, "post_accept_immediate", {
      sanitizeBody: (b) => sanitizeResponseBody(b),
    });
    this.dataApi.push(immediate);
    this.persistDataApi();

    await new Promise((r) => setTimeout(r, 2500));
    const delayed = await fetchMatchData(this.matchId, "post_accept_delayed", {
      sanitizeBody: (b) => sanitizeResponseBody(b),
    });
    this.dataApi.push(delayed);
    this.persistDataApi();
  }

  private persistDataApi() {
    const dir = join(this.ctx.sessionDir, "data-api");
    // Strip rawParsed (raw response) before writing to avoid persisting
    // potentially sensitive payload data beyond the sanitized copy.
    const serialize = (rs: DataApiRecord[]) =>
      rs.map(({ rawParsed, ...rest }) => rest);
    const pre = serialize(this.dataApi.filter((r) => r.phase === "pre_accept"));
    const postI = serialize(this.dataApi.filter((r) => r.phase === "post_accept_immediate"));
    const postD = serialize(this.dataApi.filter((r) => r.phase === "post_accept_delayed"));
    if (pre.length) writeFileSync(join(dir, "pre-accept.json"), JSON.stringify(pre, null, 2));
    if (postI.length) writeFileSync(join(dir, "post-accept-immediate.json"), JSON.stringify(postI, null, 2));
    if (postD.length) writeFileSync(join(dir, "post-accept-delayed.json"), JSON.stringify(postD, null, 2));
  }

  /** Compute roster presence for a Data API record. */
  private rosterOf(rec: DataApiRecord | null) {
    if (!rec || !rec.sanitizedBody) return { found: false, players: [] as any[], status: rec?.httpStatus ?? 0 };
    const parsed = analyzeRosterFromJson(rec.sanitizedBody, rec.responseTimestamp);
    return { found: parsed.found, players: parsed.players, status: rec.httpStatus };
  }

  /** Produce the final verdict + write diff files. */
  finish(): { answer: InvestigationAnswer; verdict: string; diffs: any[] } {
    const preRecords = this.dataApi.filter((r) => r.phase === "pre_accept");
    const postI = this.dataApi.find((r) => r.phase === "post_accept_immediate") || null;
    const postD = this.dataApi.find((r) => r.phase === "post_accept_delayed") || null;

    const preOk = preRecords.find((r) => r.httpStatus === 200) || preRecords[0] || null;
    const postUnion = postD && postD.httpStatus === 200 ? postD : postI;
    const postPayload = postUnion && postUnion.httpStatus === 200 ? postUnion : null;

    const preRoster = this.rosterOf(preOk);
    const postRoster = this.rosterOf(postPayload);

    let answer: InvestigationAnswer;
    let verdict: string;

    if (this.dataApi.some((r) => r.httpStatus === 401 || r.httpStatus === 403)) {
      answer = "INCONCLUSIVE — test or authorization failed";
      verdict = "API returned 401/403. Check FACEIT_API_KEY in .env.";
    } else if (preRoster.found) {
      answer = "YES — roster available before Accept";
      verdict = `CASE_A: Data API returned roster before Accept (${preRoster.players.length} players).`;
    } else if (postRoster.found && preOk?.httpStatus === 200 && !preRoster.found) {
      answer = "NO — match exists but roster is redacted";
      verdict = "CASE_B: Match exists pre-Accept but roster is served only after Accept.";
    } else if (this.dataApi.some((r) => r.httpStatus === 404)) {
      answer = "NO — match is not public in Data API before Accept";
      verdict = "CASE_C: Data API returned 404 before Accept; roster (if any) appears only later.";
    } else {
      answer = "INCONCLUSIVE — test or authorization failed";
      verdict = "No conclusive Data API response. Review data-api/*.json.";
    }

    // Write diffs.
    const dataApiDiff = diffPrePost(
      "open.faceit.com/data/v4/matches",
      preOk?.rawParsed ?? null,
      postPayload?.rawParsed ?? null,
      preOk?.responseTimestamp ?? null,
      postPayload?.responseTimestamp ?? null,
    );
    const internalPre = this.internal.find((r) => r.phase === "pre_accept") || null;
    const internalPost = this.internal.find((r) => r.phase === "post_accept") || null;
    const internalDiff = diffPrePost(
      "internal /api/match/v4/match",
      internalPre?.sanitizedBody ? safeParse(internalPre.sanitizedBody) : null,
      internalPost?.sanitizedBody ? safeParse(internalPost.sanitizedBody) : null,
      internalPre?.timestamp ?? null,
      internalPost?.timestamp ?? null,
    );

    writeFileSync(
      join(this.ctx.sessionDir, "diff", "data-api-diff.json"),
      JSON.stringify(dataApiDiff, null, 2),
    );
    writeFileSync(
      join(this.ctx.sessionDir, "diff", "internal-api-diff.json"),
      JSON.stringify(internalDiff, null, 2),
    );

    this.answer = answer;
    this.verdict = verdict;
    return { answer, verdict, diffs: [dataApiDiff, internalDiff] };
  }

  private answer: InvestigationAnswer | null = null;
  private verdict: string = "";

  getAnswersForReport(): { answer: InvestigationAnswer | null; verdict: string } {
    return { answer: this.answer, verdict: this.verdict };
  }

  get dataApiRecords(): DataApiRecord[] {
    return this.dataApi;
  }

  get internalRecords(): InternalMatchRecord[] {
    return this.internal;
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
