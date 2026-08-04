/**
 * Tests for matchId detection.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMatchId, MATCH_ID_WITH_PREFIX } from "./match-id.js";

const PREFIXED = "1-ed06863c-ee54-4fe1-9278-475d72991017";
const PLAIN = "ed06863c-ee54-4fe1-9278-475d72991017";

test("extractMatchId - preserves the 1- prefix", () => {
  const id = extractMatchId(
    `https://www.faceit.com/api/match/v4/match/${PREFIXED}`,
  );
  assert.strictEqual(id, PREFIXED);
});

test("extractMatchId - extracts from checkin URL", () => {
  const id = extractMatchId(
    `https://www.faceit.com/api/match/v1/checkin/${PREFIXED}`,
  );
  assert.strictEqual(id, PREFIXED);
});

test("extractMatchId - REJECTS a bare UUID (community_id false positive)", () => {
  assert.strictEqual(extractMatchId(`match ${PLAIN}`), null);

  // Real community_id from capture - must be rejected.
  assert.strictEqual(
    extractMatchId(
      "https://www.faceit.com/api/lobby/v4/lobbies:searchCommunityLobbies?community_id=7dbcab58-3727-48ea-94a2-c837b26f8350",
    ),
    null,
  );
});

test("extractMatchId - returns null when nothing matches", () => {
  assert.strictEqual(extractMatchId("no secrets here"), null);
  assert.strictEqual(extractMatchId(""), null);
});

test("extractMatchId - deduplicates repeated matchId", () => {
  // If the same matchId appears twice, extractMatchId just returns the first.
  const id = extractMatchId(`${PREFIXED} and again ${PREFIXED}`);
  assert.strictEqual(id, PREFIXED);
});

test("MATCH_ID_WITH_PREFIX - matches a 2-digit prefix", () => {
  const id = "42-00000000-0000-0000-0000-000000000000";
  const match = `url/${id}`.match(MATCH_ID_WITH_PREFIX);
  assert.ok(match);
  assert.strictEqual(match![0], id);
});
