/**
 * Tests for event classification module.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyHits,
  findPreRevealHits,
  findPostRevealHits,
  summarizeClassification,
} from "./classify-events.js";
import type { MatchHit, TimeMarker } from "../types/index.js";

const preTime = "2026-08-03T12:00:00.000Z";
const revealTime = "2026-08-03T12:00:30.000Z";
const postTime = "2026-08-03T12:01:00.000Z";

const markers: TimeMarker[] = [
  { timestamp: preTime, key: "queue_start", label: "Queue started" },
  { timestamp: revealTime, key: "reveal", label: "Opponents officially revealed" },
  { timestamp: postTime, key: "match_room", label: "Match room loaded" },
];

const hits: MatchHit[] = [
  { timestamp: "2026-08-03T12:00:05.000Z", source: "fetch", url: "/m1", path: "match_id", value: "id1", phase: "unknown" },
  { timestamp: "2026-08-03T12:00:10.000Z", source: "ws", url: "/ws", path: "status", value: "configuring", phase: "unknown" },
  { timestamp: "2026-08-03T12:00:45.000Z", source: "fetch", url: "/m2", path: "roster", value: "TeamA", phase: "unknown" },
  { timestamp: "2026-08-03T12:01:10.000Z", source: "ws", url: "/ws", path: "map", value: "de_inferno", phase: "unknown" },
];

test("classifyHits - splits pre/post reveal correctly", () => {
  const classified = classifyHits(hits, markers);

  assert.strictEqual(classified[0].phase, "pre-reveal", "hit at 12:00:05 is pre-reveal");
  assert.strictEqual(classified[1].phase, "pre-reveal", "hit at 12:00:10 is pre-reveal");
  assert.strictEqual(classified[2].phase, "post-reveal", "hit at 12:00:45 is post-reveal");
  assert.strictEqual(classified[3].phase, "post-reveal", "hit at 12:01:10 is post-reveal");
});

test("classifyHits - returns unchanged when no reveal marker", () => {
  const noRevealMarkers: TimeMarker[] = [
    { timestamp: preTime, key: "queue_start", label: "Queue started" },
  ];
  const result = classifyHits(hits, noRevealMarkers);
  assert.ok(result.every((h) => h.phase === "unknown"), "all remain unknown");
});

test("findPreRevealHits - returns only pre-reveal", () => {
  const classified = classifyHits(hits, markers);
  const pre = findPreRevealHits(classified);
  assert.strictEqual(pre.length, 2);
  assert.ok(pre.every((h) => h.phase === "pre-reveal"));
});

test("findPostRevealHits - returns only post-reveal", () => {
  const classified = classifyHits(hits, markers);
  const post = findPostRevealHits(classified);
  assert.strictEqual(post.length, 2);
  assert.ok(post.every((h) => h.phase === "post-reveal"));
});

test("summarizeClassification - counts correctly", () => {
  const classified = classifyHits(hits, markers);
  const summary = summarizeClassification(classified);
  assert.strictEqual(summary.preRevealCount, 2);
  assert.strictEqual(summary.postRevealCount, 2);
  assert.strictEqual(summary.unknownCount, 0);
  assert.ok(summary.preRevealKeys.has("match_id"));
  assert.ok(summary.preRevealKeys.has("status"));
  assert.ok(summary.postRevealKeys.has("roster"));
  assert.ok(summary.postRevealKeys.has("map"));
});

test("summarizeClassification - handles unknowns", () => {
  const summary = summarizeClassification(hits); // all unknown
  assert.strictEqual(summary.preRevealCount, 0);
  assert.strictEqual(summary.postRevealCount, 0);
  assert.strictEqual(summary.unknownCount, 4);
});
