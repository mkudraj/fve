#!/usr/bin/env node
/**
 * FACEIT Network Investigator - Main CLI
 *
 * Connects to Chrome via CDP, captures network traffic,
 * allows manual time markers (with optional DOM snapshots on
 * the teammates/accept markers), and generates a report.
 *
 * On matchId detection it also runs the official FACEIT Data API
 * investigation (pre/post Accept) to test when the roster becomes
 * available.
 *
 * Usage:
 *   npm run start
 *   npm run capture
 */
import { createInterface } from "readline";
import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { connectToChrome, disconnect } from "./cdp/connect.js";
import { attachNetworkListener } from "./cdp/network-listener.js";
import { attachWebSocketListener } from "./cdp/websocket-listener.js";
import { captureDomSnapshot } from "./capture/dom-snapshot.js";
import { extractHits } from "./analysis/extract-identifiers.js";
import { generateReport } from "./analysis/report.js";
import { Investigation } from "./analysis/investigation.js";
import type { MatchIdDetection, NetworkEvent, TimeMarker, MatchHit, SessionReport, DomSnapshot } from "./types/index.js";

// Load .env (FACEIT_API_KEY) before anything else.
import "dotenv/config";

const OUTPUT_DIR = resolve(process.cwd(), "output");

// ---- Manual time markers ----
// Keys marked with `snapshot: true` trigger a sanitized DOM snapshot of the
// player cards at that moment (used for the accept / teammates reveal UI).
const MARKER_DEFINITIONS = [
  { key: "loaded", label: "FACEIT loaded", snapshot: false },
  { key: "ac_running", label: "Anti-Cheat running", snapshot: false },
  { key: "queue_screen", label: "Queue screen opened", snapshot: false },
  { key: "find_match_clicked", label: "Find Match clicked", snapshot: false },
  { key: "queue_started", label: "Queue started", snapshot: false },
  { key: "match_found", label: "Match found / Accept visible", snapshot: true },
  { key: "pre_accept_checkpoint", label: "PRE_ACCEPT checkpoint", snapshot: false },
  { key: "accept_clicked", label: "Accept clicked", snapshot: true },
  { key: "match_room", label: "Match room opened", snapshot: false },
  { key: "stop", label: "Stop capture and generate report", snapshot: false },
];

async function main() {
  console.log("================================================");
  console.log("  FACEIT Network Investigator");
  console.log("  [Data API investigation enabled]");
  console.log("================================================");
  console.log("");

  // Connect to Chrome (with a few retries so the user can open the FACEIT tab).
  let connection;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      connection = await connectToChrome(9222);
      break;
    } catch (err) {
      lastErr = err as Error;
      if (attempt < 5) {
        console.error(`\n[ERROR] ${lastErr.message}`);
        console.log(
          `>> Open/reload a FACEIT tab in Chrome, then I'll retry in 3s (attempt ${attempt + 1}/5)...`,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  if (!connection) {
    console.error(`\n[ERROR] ${lastErr?.message}`);
    console.error(
      `Could not connect to Chrome on port 9222 with a FACEIT tab.\n` +
        `  1. Start Chrome with remote debugging (see scripts/start-chrome.ps1).\n` +
        `  2. Open and log in to https://www.faceit.com in that profile.\n` +
        `  3. Re-run: npm run capture`,
    );
    process.exit(1);
  }

  const { client } = connection;

  // Ensure CDP Runtime domain is active (used for DOM snapshots).
  try {
    await client.Runtime.enable();
  } catch {
    // Some targets may not expose Runtime; snapshots will be skipped.
  }

  // Session state
  const sessionId = Date.now().toString(36);
  const startedAt = new Date().toISOString();
  const events: NetworkEvent[] = [];
  const markers: TimeMarker[] = [];
  const snapshots: DomSnapshot[] = [];
  let hits: MatchHit[] = [];
  let currentUrl = "";

  // Session directory (created up-front so we can stream events to disk).
  const sessionDir = join(OUTPUT_DIR, `session-${sessionId}`);
  mkdirSync(sessionDir, { recursive: true });
  const eventsPath = join(sessionDir, "events.sanitized.jsonl");
  writeFileSync(eventsPath, ""); // ensures the file exists even if 0 events

  // Investigation orchestrator (Data API pre/post Accept probes).
  const investigation = new Investigation({ sessionDir });

  let lastMarkerKey: string | null = null;
  // True once the user has clicked Accept (marker 8) — used to classify the
  // internal endpoint body as post-accept.
  let accepted = false;

  // Called when a matchId is detected anywhere in the captured traffic.
  async function handleMatchIdDetected(detection: MatchIdDetection) {
    const isNew = investigation.handleDetection(detection);
    if (!isNew) return;
    console.log("");
    console.log(`  [DETECT] Match ID detected: ${detection.matchId} (${detection.source})`);
    console.log(`  >> Running pre-accept API checks...`);
    await investigation.runPreAcceptChecks();
    console.log(`  >> Pre-accept responses saved. You may click Accept.`);
  }

  // Attach network listener
  attachNetworkListener(
    client,
    (event) => {
      events.push(event);
      appendFileSync(eventsPath, JSON.stringify(event) + "\n");
      const newHits = extractHits(event);
      if (newHits.length > 0) {
        hits.push(...newHits);
        for (const hit of newHits) {
          console.log(
            `[HIT] ${hit.timestamp} | ${hit.source} | ${hit.path} | ${hit.value.substring(0, 80)}`,
          );
        }
      }
    },
    {
      onMatchIdDetected: handleMatchIdDetected,
      onInternalMatchBody: (body) => {
        investigation.handleInternalBody(body, accepted ? "post_accept" : "pre_accept");
      },
    },
  );

  // Attach WebSocket listener
  attachWebSocketListener(
    client,
    (event) => {
      events.push(event);
      appendFileSync(eventsPath, JSON.stringify(event) + "\n");
      const newHits = extractHits(event);
      if (newHits.length > 0) {
        hits.push(...newHits);
      }
    },
    {
      onMatchIdDetected: handleMatchIdDetected,
    },
  );

  // Track URL changes (with timestamp)
  client.Page.frameNavigated((params) => {
    if (params.frame.parentId) return; // only top-level frames
    currentUrl = params.frame.url;
    const navEvent: NetworkEvent = {
      timestamp: new Date().toISOString(),
      source: "xhr",
      url: params.frame.url,
      method: "NAV",
    };
    events.push(navEvent);
    appendFileSync(eventsPath, JSON.stringify(navEvent) + "\n");
    console.log(`[NAV] ${params.frame.url}`);
  });

  // Capture console messages for extra context (sanitized timestamps only).
  client.Runtime.consoleAPICalled((params) => {
    const text = params.args
      .map((a) => {
        if (typeof a.value === "string") return a.value;
        return "[non-string]";
      })
      .join(" ")
      .substring(0, 400);
    const consoleEvent: NetworkEvent = {
      timestamp: new Date().toISOString(),
      source: "fetch",
      url: "[console]",
      method: "CONSOLE",
      responseBody: text,
    };
    events.push(consoleEvent);
  });

  // Manual marker handler
  async function handleMarker(def: { key: string; label: string; snapshot: boolean }) {
    const marker: TimeMarker = {
      timestamp: new Date().toISOString(),
      key: def.key,
      label: def.label,
    };
    markers.push(marker);
    lastMarkerKey = def.key;
    console.log(`  ✓ [${marker.timestamp}] ${def.label}`);

    // Marker 6: match found / accept visible.
    if (def.key === "match_found") {
      if (!investigation.matchId) {
        console.log(`  >> Waiting for matchId...`);
      }
    }

    // Marker 8: accept clicked -> run post-accept checks.
    if (def.key === "accept_clicked") {
      accepted = true;
      if (investigation.matchId) {
        console.log(`  >> Running post-accept API checks...`);
        await investigation.runPostAcceptChecks();
        console.log(`  >> Post-accept responses saved.`);
      }
    }

    if (def.snapshot) {
      try {
        const snap = await captureDomSnapshot(client, currentUrl, def.key);
        snapshots.push(snap);
        const snapPath = join(sessionDir, "accept-dom-snapshot.json");
        writeFileSync(snapPath, JSON.stringify(snap, null, 2));
        console.log(`  [DOM] Snapshot saved (${snap.playerCards.length} player cards)`);
      } catch (err) {
        console.log(`  [DOM] Snapshot failed: ${(err as Error).message}`);
      }
    }
  }

  // Manual markers via CLI
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n[Session ${sessionId}] Capture started at ${startedAt}`);
  console.log(`Writing events to: ${eventsPath}`);
  console.log("\nManual markers (press the number):");
  console.log("──────────────────────────────────");

  printMarkerMenu();

  // Listen for keypress
  rl.on("line", async (input: string) => {
    const idx = parseInt(input.trim(), 10);

    if (input.trim() === "stop" || input.trim() === "0") {
      const endedAt = new Date().toISOString();
      const stopMarker: TimeMarker = {
        timestamp: endedAt,
        key: "stop",
        label: "Stop capture",
      };
      markers.push(stopMarker);

      console.log(`\n[STOP] Capture ended at ${endedAt}`);
      console.log(`Events: ${events.length}, Hits: ${hits.length}`);

      // Complete the investigation and compute the verdict.
      const { answer, verdict } = investigation.finish();

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
        matchId: investigation.matchId,
        matchIdDetectedAt: investigation.matchIdDetectedAt,
        matchIdSource: investigation.matchIdSource,
        dataApi: investigation.dataApiRecords,
        internal: investigation.internalRecords,
        answer,
        verdict,
      };

      generateReport(report, OUTPUT_DIR);
      printSummary(report);
      console.log(`\n  Answer: ${answer}`);
      console.log(`  Verdict: ${verdict}`);

      rl.close();
      disconnect(client).then(() => process.exit(0));
      return;
    }

    if (idx >= 1 && idx <= MARKER_DEFINITIONS.length) {
      const def = MARKER_DEFINITIONS[idx - 1];
      await handleMarker(def);
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
  console.log('  Type "stop" or press [0] to stop and generate report.\n');
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
