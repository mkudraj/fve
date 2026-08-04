/**
 * Tests for roster detection / player extraction.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeRosterFromJson, analyzeRoster } from "./roster.js";

const TS = "2026-08-04T08:00:00.000Z";

test("analyzeRosterFromJson - finds players under teams/faction rosters", () => {
  const json = JSON.stringify({
    match: {
      teams: [
        {
          faction_id: "f1",
          roster: [
            { nickname: "Alpha", player_id: "p1", steam_id_64: "76561198000000001" },
            { nickname: "Beta", player_id: "p2", steam_id_64: "76561198000000002" },
          ],
        },
        {
          faction_id: "f2",
          roster: [
            { nickname: "Gamma", player_id: "p3", steam_id_64: "76561198000000003" },
          ],
        },
      ],
    },
  });
  const result = analyzeRosterFromJson(json, TS);
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.players.length, 3);
  const beta = result.players.find((p) => p.nickname === "Beta");
  assert.ok(beta);
  assert.strictEqual(beta!.playerId, "p2");
  assert.strictEqual(beta!.steamId64, "76561198000000002");
});

test("analyzeRoster - rejects bare rosterWithSubstitutes:false as NOT a roster", () => {
  const parsed = {
    match: {
      matchId: "1-ed06863c-ee54-4fe1-9278-475d72991017",
      checkIn: { rosterWithSubstitutes: false, totalPlayers: 10 },
    },
  };
  const result = analyzeRoster(parsed, TS);
  assert.strictEqual(result.found, false, "rosterWithSubstitutes:false is not a roster");
  assert.strictEqual(result.players.length, 0);
});

test("analyzeRoster - extracts nickname/player_id/game_player_id/steam_id_64", () => {
  const parsed = {
    faction1: {
      roster: [
        {
          nickname: "OneTwoThree",
          player_id: "player-x-1",
          game_player_id: "gp-1",
          steam_id_64: "76561198000000111",
        },
      ],
    },
  };
  const result = analyzeRoster(parsed, TS);
  assert.strictEqual(result.found, true);
  const p = result.players[0];
  assert.strictEqual(p.nickname, "OneTwoThree");
  assert.strictEqual(p.playerId, "player-x-1");
  assert.strictEqual(p.gamePlayerId, "gp-1");
  assert.strictEqual(p.steamId64, "76561198000000111");
  assert.ok(p.jsonPath.length > 0);
});

test("analyzeRoster - treats game_player_id as SteamID64 fallback", () => {
  // Data API exposes SteamID64 via game_player_id, not steam_id_64.
  const parsed = {
    faction1: {
      roster: [
        { nickname: "GR1NA", player_id: "p1", game_player_id: "76561198249664530" },
      ],
    },
  };
  const result = analyzeRoster(parsed, TS);
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.players[0].steamId64, "76561198249664530");
  assert.strictEqual(result.players[0].gamePlayerId, "76561198249664530");
});

test("analyzeRoster - handles invalid JSON gracefully", () => {
  const result = analyzeRosterFromJson("{ not json", TS);
  assert.strictEqual(result.found, false);
  assert.strictEqual(result.players.length, 0);
});
