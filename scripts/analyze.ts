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
import type { NetworkEvent, TimeMarker, SessionReport } from "../src/types/index.js";

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
  };

  generateReport(report, OUTPUT_DIR);
}

main().catch(console.error);
