/**
 * Tests for the FACEIT Data API classification and the Investigation verdict
 * (Etap 11). Uses only synthetic fixtures and a mocked global `fetch` — no
 * real network calls.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { classifyDataApiResult } from "../faceit/data-api-client.js";
import { Investigation } from "./investigation.js";
import type { MatchIdDetection } from "../types/index.js";

const MATCH_ID = "1-ed06863c-ee54-4fe1-9278-475d72991017";

function detection(src = "responseBody"): MatchIdDetection {
  return {
    timestamp: "2026-08-04T08:00:00.000Z",
    matchId: MATCH_ID,
    source: src,
    url: "https://open.faceit.com/data/v4/matches/x",
  };
}

/** Mock window.fetch by status + optional body. */
function mockFetch(status: number, body: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    }) as Response;
}

test("classifyDataApiResult - maps statuses to verdicts", () => {
  const base = {
    matchId: MATCH_ID,
    phase: "pre_accept" as const,
    requestTimestamp: "t",
    responseTimestamp: "t",
    httpStatus: 0,
    ok: false,
    sanitizedBody: null,
    rawParsed: null,
    error: null,
  };
  assert.strictEqual(
    classifyDataApiResult({ ...base, httpStatus: 200, ok: true }),
    "API_200",
  );
  assert.strictEqual(
    classifyDataApiResult({ ...base, httpStatus: 404 }),
    "DATA_API_MATCH_NOT_PUBLIC_BEFORE_ACCEPT",
  );
  assert.strictEqual(
    classifyDataApiResult({ ...base, httpStatus: 401 }),
    "INCONCLUSIVE_API_AUTH_ERROR",
  );
  assert.strictEqual(
    classifyDataApiResult({ ...base, httpStatus: 429 }),
    "API_RATE_LIMITED",
  );
});

test("Investigation - CASE_C: Data API 404 before Accept => NO", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fve-inv-case-c-"));
  try {
    mockFetch(404, "{\"error\":\"not found\"}");
    const inv = new Investigation({ sessionDir: dir });
    assert.ok(inv.handleDetection(detection()));
    await inv.runPreAcceptChecks();
    const { answer, verdict } = inv.finish();
    assert.match(answer, /NO/, "404 -> match not public");
    assert.match(verdict, /CASE_C/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Investigation - CASE_A: roster in pre-accept => YES", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fve-inv-case-a-"));
  try {
    const body = JSON.stringify({
      matchId: MATCH_ID,
      teams: [
        { roster: [{ nickname: "Alpha", player_id: "p1", steam_id_64: "76561198000000001" }] },
      ],
    });
    mockFetch(200, body);
    const inv = new Investigation({ sessionDir: dir });
    assert.ok(inv.handleDetection(detection()));
    await inv.runPreAcceptChecks();
    const { answer, verdict } = inv.finish();
    assert.match(answer, /YES/, "roster present pre-accept -> YES");
    assert.match(verdict, /CASE_A/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Investigation - 401/403 => INCONCLUSIVE", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fve-inv-auth-"));
  try {
    mockFetch(401, "");
    const inv = new Investigation({ sessionDir: dir });
    assert.ok(inv.handleDetection(detection()));
    await inv.runPreAcceptChecks();
    const { answer, verdict } = inv.finish();
    assert.match(answer, /INCONCLUSIVE/);
    assert.match(verdict, /FACEIT_API_KEY/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
