#!/usr/bin/env node
/**
 * Analyze saved events from a previous capture session.
 * Reads events.sanitized.jsonl and generates a report.
 *
 * Usage:
 *   npm run analyze output/session-<id>/events.sanitized.jsonl
 *   npm run report   (reads the latest session)
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { extractHits, getMatchIds } from "../src/analysis/extract-identifiers.js";
import { generateReport } from "../src/analysis/report.js";
import type {
  NetworkEvent,
  TimeMarker,
  SessionReport,
  DataApiRecord,
  InternalMatchRecord,
  InvestigationAnswer,
} from "../src/types/index.js";

// Load .env (needed only if re-running Data API probes).
import "dotenv/config";

const OUTPUT_DIR = resolve(process.cwd(), "output");

function findLatestSession(): string | null {
  if (!existsSync(OUTPUT_DIR)) return null;
  const dirs = readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("session-"))
    .map((d) => d.name)
    .sort()
    .reverse();
  return dirs[0] || null;
}

async function main() {
  const args = process.argv.slice(2);
  const reportOnly = args.includes("--report-only");

  let sessionDir: string;

  if (args.length > 0 && !args[0].startsWith("--")) {
    sessionDir = args[0];
    if (!sessionDir.endsWith("/")) sessionDir = sessionDir;
  } else {
    const latest = findLatestSession();
    if (!latest) {
      console.error("No sessions found. Run capture first.");
      process.exit(1);
    }
    sessionDir = join(OUTPUT_DIR, latest);
  }

  console.log(`Analyzing session: ${sessionDir}`);

  // Read events
  const eventsPath = join(sessionDir, "events.sanitized.jsonl");
  let events: NetworkEvent[] = [];
  if (existsSync(eventsPath)) {
    const lines = readFileSync(eventsPath, "utf-8").trim().split("\n");
    events = lines.filter(Boolean).map((l) => JSON.parse(l));
  }

  // Read markers from report.json if it exists
  const reportPath = join(sessionDir, "report.json");
  let markers: TimeMarker[] = [];
  let sessionId = "replay";
  let startedAt = new Date().toISOString();
  if (existsSync(reportPath)) {
    const existing = JSON.parse(readFileSync(reportPath, "utf-8"));
    markers = existing.markers || [];
    sessionId = existing.sessionId || sessionId;
    startedAt = existing.startedAt || startedAt;
  }

  // Extract hits
  console.log(`Processing ${events.length} events...`);
  const hits = events.flatMap(extractHits);
  console.log(`Found ${hits.length} hits`);

  const matchIds = getMatchIds(hits);
  console.log(`Match IDs: ${matchIds.join(", ") || "none"}`);

  // Reconstruct the Data API investigation from saved fixtures (if present).
  const dataApi = loadDataApiRecords(sessionDir);
  const internal = loadInternalRecords(sessionDir);
  const matchIdFile = join(sessionDir, "match-id.json");
  let investigationMatchId: string | null = null;
  let investigationDetectedAt: string | null = null;
  let investigationSource: string | null = null;
  if (existsSync(matchIdFile)) {
    const m = JSON.parse(readFileSync(matchIdFile, "utf-8"));
    investigationMatchId = m.matchId || (matchIds[0] ?? null);
    investigationDetectedAt = m.detectedAt || null;
    investigationSource = m.source || null;
  }

  const { answer, verdict } =
    computeVerdict(investigationMatchId, dataApi, internal);

  // Generate report
  const report: SessionReport = {
    sessionId,
    startedAt,
    endedAt: new Date().toISOString(),
    markers,
    events,
    hits,
    findings: [],
    summary: {} as any,
    matchId: investigationMatchId,
    matchIdDetectedAt: investigationDetectedAt,
    matchIdSource: investigationSource,
    dataApi,
    internal,
    answer,
    verdict,
  };

  generateReport(report, OUTPUT_DIR);
}

function loadDataApiRecords(sessionDir: string): DataApiRecord[] {
  const dir = join(sessionDir, "data-api");
  const files = [
    "pre-accept.json",
    "post-accept-immediate.json",
    "post-accept-delayed.json",
  ];
  const out: DataApiRecord[] = [];
  for (const f of files) {
    const p = join(dir, f);
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && typeof parsed === "object") out.push(parsed);
    }
  }
  return out;
}

function loadInternalRecords(sessionDir: string): InternalMatchRecord[] {
  const dir = join(sessionDir, "internal-api");
  const files = ["pre-accept.json", "post-accept.json"];
  const out: InternalMatchRecord[] = [];
  for (const f of files) {
    const p = join(dir, f);
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && typeof parsed === "object") out.push(parsed);
    }
  }
  return out;
}

function hasRoster(rec: DataApiRecord | InternalMatchRecord | undefined): boolean {
  if (!rec?.sanitizedBody) return false;
  try {
    const parsed = JSON.parse(rec.sanitizedBody);
    return rosterHasPlayers(parsed);
  } catch {
    return false;
  }
}

function rosterHasPlayers(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some(
      (x) =>
        x &&
        typeof x === "object" &&
        !Array.isArray(x) &&
        ("nickname" in (x as object) || "player_id" in (x as object) || "steam_id_64" in (x as object)),
    );
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (/roster|faction|team|players|members/i.test(key) && typeof value === "object" && value !== null) {
        if (rosterHasPlayers(value)) return true;
      }
    }
  }
  return false;
}

function computeVerdict(
  matchId: string | null,
  dataApi: DataApiRecord[],
  internal: InternalMatchRecord[],
): { answer: InvestigationAnswer; verdict: string } {
  const pre = dataApi.find((r) => r.phase === "pre_accept" && r.httpStatus === 200) ??
    dataApi.find((r) => r.phase === "pre_accept");
  const postI = dataApi.find((r) => r.phase === "post_accept_immediate");
  const postD = dataApi.find((r) => r.phase === "post_accept_delayed");
  const post = (postD && postD.httpStatus === 200 ? postD : postI);
  const postOk = post && post.httpStatus === 200 ? post : undefined;

  if (dataApi.some((r) => r.httpStatus === 401 || r.httpStatus === 403)) {
    return {
      answer: "INCONCLUSIVE — test or authorization failed",
      verdict: "API returned 401/403. Check FACEIT_API_KEY in .env.",
    };
  }
  if (pre && hasRoster(pre)) {
    return {
      answer: "YES — roster available before Accept",
      verdict: "CASE_A: Data API returned roster before Accept (players present in pre-accept payload).",
    };
  }
  if (postOk && hasRoster(postOk) && pre?.httpStatus === 200) {
    return {
      answer: "NO — match exists but roster is redacted",
      verdict: "CASE_B: Match exists pre-Accept but roster is served only after Accept.",
    };
  }
  if (dataApi.some((r) => r.httpStatus === 404)) {
    return {
      answer: "NO — match is not public in Data API before Accept",
      verdict: "CASE_C: Data API returned 404 before Accept; roster (if any) appears only later.",
    };
  }
  if (!matchId) {
    return {
      answer: "INCONCLUSIVE — test or authorization failed",
      verdict: "No matchId was detected, so no Data API probes were run.",
    };
  }
  return {
    answer: "INCONCLUSIVE — test or authorization failed",
    verdict: "No conclusive Data API response. Review data-api/*.json.",
  };
}

main().catch(console.error);
