/**
 * Tests for roster extraction from FACEIT Data API responses.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractRoster, isFullRoster, totalPlayers } from "./roster.js";

const FACTION1_ROSTER = [
  {
    player_id: "p1",
    nickname: "GR1NA",
    game_player_id: "76561198249664530",
    game_player_name: "Gringo",
    game_skill_level: 10,
    membership: "premium",
    anticheat_required: true,
  },
  {
    player_id: "p2",
    nickname: "siNCo-",
    game_player_id: "76561198119694078",
    game_player_name: "siNCo",
    game_skill_level: 10,
    membership: "free",
    anticheat_required: true,
  },
  {
    player_id: "p3",
    nickname: "-AthE",
    game_player_id: "76561198838634986",
    game_player_name: "AthE",
    game_skill_level: 10,
    membership: "premium",
    anticheat_required: true,
  },
  {
    player_id: "p4",
    nickname: "-T0KI",
    game_player_id: "76561198838474668",
    game_player_name: "T0KI",
    game_skill_level: 10,
    membership: "free",
    anticheat_required: true,
  },
  {
    player_id: "p5",
    nickname: "Ceo---",
    game_player_id: "76561198362845213",
    game_player_name: "Ceo",
    game_skill_level: 10,
    membership: "premium",
    anticheat_required: true,
  },
];

const FACTION2_ROSTER = [
  {
    player_id: "p6",
    nickname: "108-",
    game_player_id: "76561198782132866",
    game_player_name: "108",
    game_skill_level: 10,
    membership: "free",
    anticheat_required: true,
  },
  {
    player_id: "p7",
    nickname: "shorstky",
    game_player_id: "76561198070756713",
    game_player_name: "shorstky",
    game_skill_level: 10,
    membership: "premium",
    anticheat_required: true,
  },
  {
    player_id: "p8",
    nickname: "tumi",
    game_player_id: "76561198035293177",
    game_player_name: "tumi",
    game_skill_level: 10,
    membership: "free",
    anticheat_required: true,
  },
  {
    player_id: "p9",
    nickname: "shadyb",
    game_player_id: "76561198080436813",
    game_player_name: "shadyb",
    game_skill_level: 10,
    membership: "premium",
    anticheat_required: true,
  },
  {
    player_id: "p10",
    nickname: "AHLIN-",
    game_player_id: "76561198108255427",
    game_player_name: "AHLIN",
    game_skill_level: 10,
    membership: "free",
    anticheat_required: true,
  },
];

function buildMatchBody(overrides?: Record<string, unknown>) {
  return {
    match_id: "1-ed06863c-ee54-4fe1-9278-475d72991017",
    game: "cs2",
    region: "EU",
    status: "CHECK_IN",
    teams: {
      faction1: {
        name: "team_GR1NA",
        roster: FACTION1_ROSTER,
      },
      faction2: {
        name: "team_108-",
        roster: FACTION2_ROSTER,
      },
    },
    ...overrides,
  };
}

test("extractRoster - full 5+5 roster from Data API", () => {
  const result = extractRoster(buildMatchBody());
  assert.strictEqual(result.faction1.length, 5);
  assert.strictEqual(result.faction2.length, 5);
  assert.strictEqual(result.matchStatus, "CHECK_IN");
});

test("extractRoster - player fields are mapped correctly", () => {
  const result = extractRoster(buildMatchBody());
  const p = result.faction1[0];
  assert.strictEqual(p.nickname, "GR1NA");
  assert.strictEqual(p.playerId, "p1");
  assert.strictEqual(p.steamId64, "76561198249664530");
  assert.strictEqual(p.steamName, "Gringo");
  assert.strictEqual(p.level, 10);
  assert.strictEqual(p.membership, "premium");
  assert.strictEqual(p.anticheatRequired, true);
  assert.strictEqual(p.team, "team_GR1NA");
});

test("extractRoster - faction2 players are mapped", () => {
  const result = extractRoster(buildMatchBody());
  const p = result.faction2[0];
  assert.strictEqual(p.nickname, "108-");
  assert.strictEqual(p.steamId64, "76561198782132866");
  assert.strictEqual(p.team, "team_108-");
});

test("extractRoster - game_player_id is treated as SteamID64", () => {
  const result = extractRoster(buildMatchBody());
  for (const p of [...result.faction1, ...result.faction2]) {
    assert.ok(p.steamId64, `player ${p.nickname} should have steamId64`);
    assert.match(p.steamId64!, /^765611/);
  }
});

test("extractRoster - handles null input", () => {
  const result = extractRoster(null);
  assert.strictEqual(result.faction1.length, 0);
  assert.strictEqual(result.faction2.length, 0);
});

test("extractRoster - handles empty object", () => {
  const result = extractRoster({});
  assert.strictEqual(result.faction1.length, 0);
});

test("extractRoster - handles missing teams", () => {
  const result = extractRoster({ status: "CHECK_IN" });
  assert.strictEqual(result.faction1.length, 0);
});

test("extractRoster - handles partial roster (< 5 players)", () => {
  const result = extractRoster(
    buildMatchBody({
      teams: {
        faction1: { roster: FACTION1_ROSTER.slice(0, 3) },
        faction2: { roster: [] },
      },
    }),
  );
  assert.strictEqual(result.faction1.length, 3);
  assert.strictEqual(result.faction2.length, 0);
});

test("extractRoster - handles missing roster array", () => {
  const result = extractRoster({
    teams: { faction1: { name: "team_x" }, faction2: {} },
  });
  assert.strictEqual(result.faction1.length, 0);
  assert.strictEqual(result.faction2.length, 0);
});

test("isFullRoster - returns true for 5+5", () => {
  const f1 = Array(5).fill({ nickname: "x" });
  const f2 = Array(5).fill({ nickname: "y" });
  assert.strictEqual(isFullRoster(f1 as never, f2 as never), true);
});

test("isFullRoster - returns false for 4+5", () => {
  const f1 = Array(4).fill({ nickname: "x" });
  const f2 = Array(5).fill({ nickname: "y" });
  assert.strictEqual(isFullRoster(f1 as never, f2 as never), false);
});

test("totalPlayers - sums both factions", () => {
  assert.strictEqual(
    totalPlayers(
      FACTION1_ROSTER as never,
      FACTION2_ROSTER as never,
    ),
    10,
  );
});
