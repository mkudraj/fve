#!/usr/bin/env node
/**
 * FACEIT Network Investigator - Main CLI
 *
 * Connects to Chrome via CDP, captures network traffic,
 * allows manual time markers, and generates a report.
 *
 * Usage:
 *   npm run start
 *   npm run capture
 */
import { createInterface } from "readline";
import { writeFileSync } from "fs";
import { join, resolve } from "path";
import { connectToChrome, disconnect } from "./cdp/connect.js";
import { attachNetworkListener } from "./cdp/network-listener.js";
import { attachWebSocketListener } from "./cdp/websocket-listener.js";
import { extractHits } from "./analysis/extract-identifiers.js";
import { generateReport } from "./analysis/report.js";
import type { NetworkEvent, TimeMarker, MatchHit, SessionReport } from "./types/index.js";

const OUTPUT_DIR = resolve(process.cwd(), "output");

// ---- Manual time markers ----
const MARKER_DEFINITIONS = [
  { key: "queue_start", label: "Queue started" },
  { key: "match_found", label: "Match found" },
  { key: "ready_check", label: "Ready check visible" },
  { key: "accepted", label: "Accepted" },
  { key: "reveal", label: "Opponents officially revealed" },
  { key: "match_room", label: "Match room loaded" },
  { key: "stop", label: "Stop capture and generate report" },
];

async function main() {
  console.log("================================================");
  console.log("  FACEIT Network Investigator");
  console.log("================================================");
  console.log("");

  // Connect to Chrome
  let connection;
  try {
    connection = await connectToChrome(9222);
  } catch (err) {
    console.error(`[ERROR] ${(err as Error).message}`);
    process.exit(1);
  }

  const { client } = connection;

  // Session state
  const sessionId = Date.now().toString(36);
  const startedAt = new Date().toISOString();
  const events: NetworkEvent[] = [];
  const markers: TimeMarker[] = [];
  let hits: MatchHit[] = [];

  // Attach network listener
  attachNetworkListener(client, (event) => {
    events.push(event);
    const newHits = extractHits(event);
    if (newHits.length > 0) {
      hits.push(...newHits);
      for (const hit of newHits) {
        console.log(
          `[HIT] ${hit.timestamp} | ${hit.path} | ${hit.value.substring(0, 80)}`,
        );
      }
    }
  });

  // Attach WebSocket listener
  attachWebSocketListener(client, (event) => {
    events.push(event);
    const newHits = extractHits(event);
    if (newHits.length > 0) {
      hits.push(...newHits);
    }
  });

  // Track URL changes
  client.Page.frameNavigated((params) => {
    console.log(`[NAV] ${params.frame.url}`);
  });

  // Manual markers via CLI
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n[Session ${sessionId}] Capture started at ${startedAt}`);
  console.log("\nManual markers (press the number):");
  console.log("──────────────────────────────────");

  printMarkerMenu();

  // Listen for keypress
  rl.on("line", (input: string) => {
    const idx = parseInt(input.trim(), 10);

    if (input.trim() === "stop" || input.trim() === "7") {
      const endedAt = new Date().toISOString();
      const stopMarker: TimeMarker = {
        timestamp: endedAt,
        key: "stop",
        label: "Stop capture",
      };
      markers.push(stopMarker);

      console.log(`\n[STOP] Capture ended at ${endedAt}`);
      console.log(`Events: ${events.length}, Hits: ${hits.length}`);

      // Generate report
      const report: SessionReport = {
        sessionId,
        startedAt,
        endedAt,
        markers,
        events,
        hits,
        findings: [],
        summary: {} as any,
      };

      generateReport(report, OUTPUT_DIR);
      printSummary(report);

      rl.close();
      disconnect(client).then(() => process.exit(0));
      return;
    }

    if (idx >= 1 && idx <= MARKER_DEFINITIONS.length) {
      const def = MARKER_DEFINITIONS[idx - 1];
      const marker: TimeMarker = {
        timestamp: new Date().toISOString(),
        key: def.key,
        label: def.label,
      };
      markers.push(marker);
      console.log(`  ✓ [${marker.timestamp}] ${def.label}`);
    } else {
      console.log("  Invalid marker number. Try again:");
      printMarkerMenu();
    }
  });

  // Handle SIGINT
  process.on("SIGINT", async () => {
    console.log("\n[INTERRUPT] Stopping capture...");
    rl.close();
    await disconnect(client);
    process.exit(0);
  });
}

function printMarkerMenu() {
  MARKER_DEFINITIONS.forEach((def, i) => {
    console.log(`  [${i + 1}] ${def.label}`);
  });
  console.log("");
  console.log('  Type "stop" or press the number to mark events.\n');
}

function printSummary(report: SessionReport) {
  const preCount = report.hits.filter((h) => h.phase === "pre-reveal").length;
  console.log(`\n================================================`);
  console.log(`  SUMMARY`);
  console.log(`================================================`);
  console.log(`  Pre-reveal hits: ${preCount}`);
  console.log(
    `  Recommendation: ${report.summary.recommendation.substring(0, 80)}...`,
  );
}

// Run
main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
