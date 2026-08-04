/**
 * Generate session report in Markdown and JSON formats.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type {
  SessionReport,
  ReportSummary,
  ReportRow,
  Finding,
} from "../types/index.js";
import { classifyHits, findPreRevealHits, summarizeClassification } from "./classify-events.js";
import { buildTimeline } from "./timeline.js";
import { getMatchIds } from "./extract-identifiers.js";
import { analyzeRosterFromJson } from "./roster.js";

export function generateReport(
  report: SessionReport,
  outputDir: string,
): void {
  // Classify all hits
  report.hits = classifyHits(report.hits, report.markers);
  const classResult = summarizeClassification(report.hits);
  const preRevealHits = findPreRevealHits(report.hits);
  const matchIds = getMatchIds(report.hits);
  const revealMarker = report.markers.find((m) => m.key === "reveal");
  const revealTime = revealMarker?.timestamp;

  // Build summary
  const matchIdFirstSeen =
    preRevealHits.find((h) => h.path.includes("match"))?.timestamp || null;
  const matchIdBeforeReveal = preRevealHits.some((h) => h.path.includes("match"));
  const rosterFirstSeen =
    preRevealHits.find(
      (h) =>
        h.path.includes("roster") ||
        h.path.includes("player") ||
        h.path.includes("faction"),
    )?.timestamp || null;
  const rosterBeforeReveal = preRevealHits.some(
    (h) =>
      h.path.includes("roster") ||
      h.path.includes("player") ||
      h.path.includes("faction"),
  );
  const mapFirstSeen =
    preRevealHits.find((h) => h.path.includes("map"))?.timestamp || null;
  const mapBeforeReveal = preRevealHits.some((h) => h.path.includes("map"));
  const serverFirstSeen =
    preRevealHits.find((h) => h.path.includes("server") || h.path.includes("connect"))?.timestamp ||
    null;
  const serverBeforeReveal = preRevealHits.some(
    (h) => h.path.includes("server") || h.path.includes("connect"),
  );
  const dataSource = preRevealHits[0]?.source || null;

  const summary: ReportSummary = {
    matchIdFirstSeen,
    matchIdBeforeReveal,
    rosterFirstSeen,
    rosterBeforeReveal,
    mapFirstSeen,
    mapBeforeReveal,
    serverFirstSeen,
    serverBeforeReveal,
    dataSource,
    recommendation: buildRecommendation(
      { matchIdBeforeReveal, rosterBeforeReveal, matchIdFirstSeen, rosterFirstSeen, mapFirstSeen, mapBeforeReveal, serverFirstSeen, serverBeforeReveal, dataSource, recommendation: "", table: [] },
      preRevealHits,
    ),
    table: buildReportTable(report),
  };

  report.summary = summary;

  // Generate findings
  report.findings = generateFindings(report);

  // Save JSON
  const sessionDir = join(outputDir, `session-${report.sessionId}`);
  mkdirSync(sessionDir, { recursive: true });

  writeFileSync(
    join(sessionDir, "report.json"),
    JSON.stringify(report, null, 2),
  );

  // Save timeline
  const timeline = buildTimeline(report.markers, report.events, report.hits);
  writeFileSync(join(sessionDir, "timeline.json"), JSON.stringify(timeline, null, 2));

  // Save hits
  writeFileSync(join(sessionDir, "matches.json"), JSON.stringify(report.hits, null, 2));

  // Generate Markdown report
  const md = generateMarkdownReport(report);
  writeFileSync(join(sessionDir, "report.md"), md);

  console.log(`\n[Report] Generated in ${sessionDir}/`);
  console.log(`  report.json, report.md, timeline.json, matches.json`);
}

function buildReportTable(report: SessionReport): ReportRow[] {
  const rows: ReportRow[] = [];
  const revealMarker = report.markers.find((m) => m.key === "reveal");
  const revealTime = revealMarker?.timestamp;

  const categories = [
    { label: "match_id", paths: ["match_id", "matchid"] },
    { label: "Roster", paths: ["roster"] },
    { label: "Players", paths: ["player", "nickname"] },
    { label: "Faction/Teams", paths: ["faction", "team"] },
    { label: "Map", paths: ["map"] },
    { label: "Server/Connect", paths: ["server", "connect"] },
    { label: "Status", paths: ["status", "ready"] },
  ];

  for (const cat of categories) {
    const match = report.hits.find((h) =>
      cat.paths.some((p) => h.path.toLowerCase().includes(p)),
    );
    rows.push({
      data: cat.label,
      firstSeen: match?.timestamp || "N/A",
      beforeReveal: match && revealTime && match.timestamp < revealTime
        ? "YES"
        : "no",
      source: match?.source || "N/A",
      confidence: match ? "high" : "low",
    });
  }

  return rows;
}

function buildRecommendation(
  summary: ReportSummary,
  preRevealHits: unknown[],
): string {
  if (summary.matchIdBeforeReveal && summary.rosterBeforeReveal) {
    return "CASE_A: Full roster available before reveal. Build Tampermonkey PoC or Chrome Extension.";
  }
  if (summary.matchIdBeforeReveal && !summary.rosterBeforeReveal) {
    return "CASE_B: match_id available early, roster hidden. Check official API at match creation time.";
  }
  if (preRevealHits.length > 0) {
    return "CASE_PARTIAL: Some data available pre-reveal. Review preRevealKeys for details.";
  }
  return "CASE_C: No pre-reveal data. Limitation is server-side. Consider post-reveal instant scout.";
}

function generateFindings(report: SessionReport): Finding[] {
  const s = report.summary;
  return [
    {
      question: "When did match_id first appear?",
      answer: s.matchIdFirstSeen || "Not found",
      evidence: "From extracted hits",
      confidence: s.matchIdFirstSeen ? "high" : "medium",
    },
    {
      question: "Did match_id appear before official reveal?",
      answer: s.matchIdBeforeReveal ? "Yes" : "No",
      evidence: "Compared timestamps with reveal marker",
      confidence: "high",
    },
    {
      question: "Did opponent roster appear before reveal?",
      answer: s.rosterBeforeReveal ? "Yes" : "No",
      evidence: "Searched for roster/player/faction in pre-reveal events",
      confidence: "high",
    },
    {
      question: "Did map appear before reveal?",
      answer: s.mapBeforeReveal ? "Yes" : "No",
      evidence: "Searched for map field",
      confidence: "high",
    },
    {
      question: "Did server data appear before reveal?",
      answer: s.serverBeforeReveal ? "Yes" : "No",
      evidence: "Searched for server/connect field",
      confidence: "high",
    },
    {
      question: "What is the data source?",
      answer: s.dataSource || "Unknown",
      evidence: "Source of first pre-reveal hit",
      confidence: s.dataSource ? "high" : "low",
    },
    {
      question: "Is the data hidden by UI or not sent by backend?",
      answer: s.rosterBeforeReveal
        ? "Data is sent by backend but hidden by UI"
        : "Data is NOT sent by backend before reveal",
      evidence: "Based on network capture analysis",
      confidence: "medium",
    },
    {
      question: "What solution can be built?",
      answer: s.recommendation,
      evidence: "Based on classification results",
      confidence: "medium",
    },
  ];
}

function buildInvestigationTable(report: SessionReport): string {
  const rows: string[] = [];
  rows.push("| Source | Phase | HTTP status | Match ID | Player count | Nicknames | Player IDs | Steam IDs |");
  rows.push("|---|---|---|---|---|---|---|---|");

  const byPhase: Record<string, { status: number; body: string | null; ts: string }> = {};
  for (const r of report.dataApi) {
    byPhase[r.phase] = { status: r.httpStatus, body: r.sanitizedBody, ts: r.responseTimestamp };
  }
  for (const i of report.internal) {
    byPhase[`internal_${i.phase}`] = { status: 0, body: i.sanitizedBody, ts: i.timestamp };
  }

  const analyze = (body: string | null, ts: string) => {
    if (!body) return { count: 0, nicks: "—", pids: "—", steams: "—" };
    try {
      const parsed = analyzeRosterFromJson(body, ts);
      const players = parsed.players;
      return {
        count: players.length,
        nicks: players.map((p) => p.nickname ?? "?").join(", "),
        pids: players.map((p) => p.playerId ?? "?").join(", "),
        steams: players.map((p) => p.steamId64 ?? "?").join(", "),
      };
    } catch {
      return { count: 0, nicks: "—", pids: "—", steams: "—" };
    }
  };

  const order: Array<[string, string]> = [
    ["pre_accept", "Data API / pre-accept"],
    ["post_accept_immediate", "Data API / post-accept immediate"],
    ["post_accept_delayed", "Data API / post-accept delayed"],
    ["internal_pre_accept", "Internal / pre-accept"],
    ["internal_post_accept", "Internal / post-accept"],
  ];
  for (const [key, label] of order) {
    const rec = byPhase[key];
    if (!rec) continue;
    const a = analyze(rec.body, rec.ts);
    rows.push(`| ${label} | ${key} | ${rec.status || "n/a"} | ${report.matchId ?? "—"} | ${a.count} | ${a.nicks.substring(0, 120)} | ${a.pids.substring(0, 120)} | ${a.steams.substring(0, 120)} |`);
  }
  return rows.join("\n");
}

function generateMarkdownReport(report: SessionReport): string {
  const s = report.summary;
  let md = "";

  md += `# FACEIT Pre-Match Investigation Report\n\n`;
  md += `**Session:** ${report.sessionId}\n`;
  md += `**Started:** ${report.startedAt}\n`;
  md += `**Ended:** ${report.endedAt}\n`;
  md += `**Events captured:** ${report.events.length}\n`;
  md += `**Hits found:** ${report.hits.length}\n`;
  md += `**Pre-reveal hits:** ${report.hits.filter((h) => h.phase === "pre-reveal").length}\n\n`;

  md += `## Markers\n\n`;
  for (const m of report.markers) {
    md += `- ${m.timestamp}: [${m.key}] ${m.label}\n`;
  }

  md += `\n## Summary\n\n`;
  md += `| Data | First Seen | Before Reveal | Source | Confidence |\n`;
  md += `|------|-----------|---------------|--------|------------|\n`;
  for (const row of s.table) {
    md += `| ${row.data} | ${row.firstSeen} | ${row.beforeReveal} | ${row.source} | ${row.confidence} |\n`;
  }

  md += `\n## Findings\n\n`;
  for (const f of report.findings) {
    md += `### ${f.question}\n`;
    md += `**Answer:** ${f.answer}\n\n`;
    md += `_Evidence:_ ${f.evidence} _(confidence: ${f.confidence})_\n\n`;
  }

  md += `\n## Recommendation\n\n`;
  md += `${s.recommendation}\n\n`;

  md += `## Investigation (Data API vs Internal, pre/post Accept)\n\n`;
  if (report.dataApi.length === 0 && report.internal.length === 0) {
    md += `_No investigation data — matchId was not detected and no API requests were made._\n\n`;
  } else {
    md += `${buildInvestigationTable(report)}\n\n`;
  }

  md += `## Answer & Verdict\n\n`;
  md += `**Answer:** ${report.answer ?? "—"}\n\n`;
  md += `**Verdict:** ${report.verdict ?? "—"}\n\n`;

  md += `## Pre-reveal hits (top 20)\n\n`;
  const preHits = report.hits.filter((h) => h.phase === "pre-reveal").slice(0, 20);
  for (const h of preHits) {
    md += `- \`${h.timestamp}\` — **${h.path}** = \`${h.value.substring(0, 100)}\` (${h.source})\n`;
  }

  return md;
}
