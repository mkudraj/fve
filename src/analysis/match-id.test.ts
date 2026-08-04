/**
 * Tests for matchId detection — including the full `1-` prefix and the
 * regression case 1-ed06863c-ee54-4fe1-9278-475d72991017.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractMatchId,
  detectMatchId,
  MATCH_ID_WITH_PREFIX,
  MATCH_ID_UUID,
} from "./match-id.js";

const PREFIXED = "1-ed06863c-ee54-4fe1-9278-475d72991017";
const PLAIN = "ed06863c-ee54-4fe1-9278-475d72991017";

test("extractMatchId - preserves the 1- prefix (regression)", () => {
  const id = extractMatchId(`https://www.faceit.com/api/match/v4/match/${PREFIXED}`);
  assert.strictEqual(id, PREFIXED, "full id incl. prefix is preserved");
});

test("extractMatchId - prefers prefixed form over bare UUID", () => {
  const id = extractMatchId(`garbage ${PREFIXED} and also ${PLAIN}`);
  assert.strictEqual(id, PREFIXED);
});

test("extractMatchId - REJECTS a bare UUID (community_id false positive)", () => {
  assert.strictEqual(extractMatchId(`match ${PLAIN}`), null, "bare UUID is not a matchId");
  // The exact community_id from the real capture must be rejected.
  assert.strictEqual(
    extractMatchId("https://www.faceit.com/api/lobby/v4/lobbies:searchCommunityLobbies?community_id=7dbcab58-3727-48ea-94a2-c837b26f8350"),
    null,
    "community_id is a false positive and must be ignored",
  );
});

test("extractMatchId - returns null when nothing matches", () => {
  assert.strictEqual(extractMatchId("no secrets here"), null);
});

test("detectMatchId - finds id in response body", () => {
  const detection = detectMatchId({
    timestamp: "2026-08-04T08:00:00.000Z",
    url: "https://open.faceit.com/data/v4/matches/x",
    responseBody: JSON.stringify({ payload: { match_id: PREFIXED } }),
  });
  assert.ok(detection);
  assert.strictEqual(detection!.matchId, PREFIXED);
  assert.strictEqual(detection!.source, "responseBody");
});

test("detectMatchId - finds prefixed id in ws frame", () => {
  const detection = detectMatchId({
    timestamp: "2026-08-04T08:00:01.000Z",
    url: "wss://faceit.com/ws",
    wsFrameData: JSON.stringify({ match: PREFIXED }),
  });
  assert.ok(detection);
  assert.strictEqual(detection!.matchId, PREFIXED);
  assert.strictEqual(detection!.source, "wsFrame");
});

test("MATCH_ID_WITH_PREFIX - matches a 1- prefixed uuid in a url", () => {
  const url = `https://www.faceit.com/api/match/v4/match/${PREFIXED}`;
  const match = url.match(MATCH_ID_WITH_PREFIX);
  assert.ok(match);
  assert.strictEqual(match![0], PREFIXED);
});

test("MATCH_ID_UUID - matches a plain uuid regex but extractMatchId rejects it", () => {
  const match = `token ${PLAIN} tail`.match(MATCH_ID_UUID);
  assert.ok(match);
  assert.strictEqual(match![0], PLAIN);
  // The regex matches, but extractMatchId must NOT use it as a matchId.
  assert.strictEqual(extractMatchId(`token ${PLAIN} tail`), null);
});
