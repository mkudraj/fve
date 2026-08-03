/**
 * Tests for identifier extraction module.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractHits, getMatchIds } from "./extract-identifiers.js";
import type { NetworkEvent, MatchHit } from "../types/index.js";

function makeEvent(overrides: Partial<NetworkEvent> = {}): NetworkEvent {
  return {
    timestamp: "2026-08-03T12:00:00.000Z",
    source: "fetch",
    url: "https://api.faceit.com/match/v2",
    ...overrides,
  };
}

test("extractHits - finds match_id in response body", () => {
  const event = makeEvent({
    responseBody: JSON.stringify({
      payload: {
        match_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "configuring",
      },
    }),
  });

  const hits = extractHits(event);
  assert.ok(hits.length >= 2, "found hits for match_id and status");
  assert.ok(hits.some((h) => h.path.includes("match_id")), "hit for match_id key");
  assert.ok(hits.some((h) => h.path.includes("status")), "hit for status key");
});

test("extractHits - finds match_room in URL", () => {
  const event = makeEvent({
    url: "https://api.faceit.com/microsrv-matchmaking/api/matchroom/abc123def456",
    responseBody: "",
  });

  const hits = extractHits(event);
  assert.ok(hits.length >= 1, "found hit for matchroom in URL");
});

test("extractHits - finds roster data nested", () => {
  const event = makeEvent({
    responseBody: JSON.stringify({
      matchmaking: {
        roster: [
          { player_id: "p1", nickname: "PlayerOne" },
          { player_id: "p2", nickname: "PlayerTwo" },
        ],
      },
    }),
  });

  const hits = extractHits(event);
  assert.ok(hits.some((h) => h.path.includes("roster")), "hit for roster");
  assert.ok(hits.some((h) => h.path.includes("player_id")), "hit for player_id");
  assert.ok(hits.some((h) => h.path.includes("nickname")), "hit for nickname");
});

test("extractHits - finds map and server fields", () => {
  const event = makeEvent({
    responseBody: JSON.stringify({
      matchId: "whatever",
      selectedMap: "de_dust2",
      serverAddress: "192.168.1.1:27015",
      connect: "connect 192.168.1.1:27015; password secret",
    }),
  });

  const hits = extractHits(event);
  const paths = hits.map((h) => h.path);
  assert.ok(paths.some((p) => p.toLowerCase().includes("map")), "hit for map");
  assert.ok(paths.some((p) => p.toLowerCase().includes("server")), "hit for server");
  assert.ok(paths.some((p) => p.toLowerCase().includes("connect")), "hit for connect");
});

test("extractHits - no false positives on unrelated JSON", () => {
  const event = makeEvent({
    responseBody: JSON.stringify({ user: { id: 1, name: "test" } }),
  });

  const hits = extractHits(event);
  assert.strictEqual(hits.length, 0, "no hits in unrelated JSON");
});

test("extractHits - handles WebSocket frames", () => {
  const event = makeEvent({
    source: "websocket-received",
    wsFrameData: JSON.stringify({ match_id: "ws-match-123", status: "ready" }),
  });

  const hits = extractHits(event);
  assert.ok(hits.length >= 2, "finds hits in WS frames");
  assert.ok(hits.some((h) => h.path.includes("match_id")), "match_id from WS");
});

test("extractHits - handles empty response bodies", () => {
  const event = makeEvent({ responseBody: "" });
  const hits = extractHits(event);
  assert.ok(hits.length <= 1, "only URL hits when body is empty");
});

test("extractHits - finds embedded JSON in strings", () => {
  const event = makeEvent({
    responseBody: JSON.stringify({
      data: '{"match_id":"nested-json-id","faction1":"A"}',
    }),
  });

  const hits = extractHits(event);
  assert.ok(hits.some((h) => h.path.includes("match_id")), "finds nested JSON match_id");
});

test("getMatchIds - extracts unique UUIDs", () => {
  const hits: MatchHit[] = [
    { timestamp: "t1", source: "fetch", url: "/", path: "mid", value: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", phase: "pre-reveal" },
    { timestamp: "t2", source: "fetch", url: "/", path: "mid", value: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", phase: "pre-reveal" },
    { timestamp: "t3", source: "fetch", url: "/", path: "mid", value: "ffffffff-aaaa-bbbb-cccc-dddddddddddd", phase: "post-reveal" },
  ];

  const ids = getMatchIds(hits);
  assert.strictEqual(ids.length, 2, "finds 2 unique match IDs");
  assert.ok(ids.includes("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"));
  assert.ok(ids.includes("ffffffff-aaaa-bbbb-cccc-dddddddddddd"));
});
