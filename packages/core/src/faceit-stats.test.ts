/**
 * Tests for FACEIT internal stats parsing (faceit-stats.ts).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFaceitStats, fetchFaceitPlayerStats } from "./faceit-stats.js";

const lifetime = {
  lifetime: {
    m1: "3413",
  },
};

const match = (
  c2: string,
  c3: string,
  c4: string,
  c10: string,
  i2: string,
  teamId: string,
  gameMode = "5v5",
) => ({ c2, c3, c4, c10, i2, teamId, gameMode });

test("parseFaceitStats - aggregates last 20 matches + lifetime matches", () => {
  const time = [
    match("1.82", "1", "55", "98.4", "aaa", "aaa"),
    match("1.12", "0.9", "33", "100.3", "bbb", "bbb"),
    match("0.9", "0.8", "40", "80", "ccc", "ccc"),
    // non-5v5 entry must be filtered out
    match("2.0", "1.1", "60", "90", "ddd", "ddd", "1v1"),
  ];

  const stats = parseFaceitStats(lifetime, time);
  assert.ok(stats);
  assert.strictEqual(stats.matchesAnalyzed, 3);
  assert.strictEqual(stats.totalMatches, 3413);
  // all three 5v5 entries are wins (i2 === teamId)
  assert.ok(stats.winRate !== null);
  assert.ok(Math.abs(stats.winRate - 1) < 1e-9);
  // averages
  assert.ok(stats.kdRatio !== null);
  assert.ok(Math.abs(stats.kdRatio - (1.82 + 1.12 + 0.9) / 3) < 1e-9);
  assert.ok(stats.killsPerRound !== null);
  assert.ok(Math.abs(stats.killsPerRound - (1 + 0.9 + 0.8) / 3) < 1e-9);
  assert.ok(stats.adr !== null);
  assert.ok(Math.abs(stats.adr - (98.4 + 100.3 + 80) / 3) < 1e-9);
  assert.ok(stats.headshotRate !== null);
  assert.ok(Math.abs(stats.headshotRate - (55 + 33 + 40) / 3) < 1e-9);
});

test("parseFaceitStats - win rate counts only i2===teamId", () => {
  const time = [
    match("1.0", "0.5", "50", "70", "teamA", "teamA"),
    match("1.0", "0.5", "50", "70", "otherTeam", "teamA"),
    match("1.0", "0.5", "50", "70", "teamB", "teamB"),
  ];
  const stats = parseFaceitStats(lifetime, time);
  assert.ok(stats);
  assert.ok(stats.winRate !== null);
  assert.ok(Math.abs(stats.winRate - 2 / 3) < 1e-9);
});

test("parseFaceitStats - returns null for empty / non-array input", () => {
  assert.strictEqual(parseFaceitStats(lifetime, null), null);
  assert.strictEqual(parseFaceitStats(lifetime, []), null);
  assert.strictEqual(parseFaceitStats(null, undefined), null);
});

test("parseFaceitStats - falls back to analyzed count when lifetime missing", () => {
  const time = [match("1.0", "0.5", "50", "70", "a", "a")];
  const stats = parseFaceitStats({}, time);
  assert.ok(stats);
  assert.strictEqual(stats.totalMatches, 1);
});

test("fetchFaceitPlayerStats - parses both endpoints", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("/time/users/")) {
      return new Response(
        JSON.stringify([match("1.82", "1", "55", "98.4", "aaa", "aaa")]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify(lifetime), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const stats = await fetchFaceitPlayerStats("9c3b4375-b820-43bd-bb16-dff72046f6ec");
    assert.ok(stats);
    assert.strictEqual(stats.totalMatches, 3413);
    assert.strictEqual(stats.matchesAnalyzed, 1);
    assert.ok(stats.kdRatio !== null);
    assert.ok(Math.abs(stats.kdRatio - 1.82) < 1e-9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchFaceitPlayerStats - returns null on HTTP error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("no", { status: 403 });
  try {
    assert.strictEqual(await fetchFaceitPlayerStats("someone"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
