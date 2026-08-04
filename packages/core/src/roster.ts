/**
 * Roster extraction from FACEIT Data API match responses.
 *
 * Parses the official Data API structure:
 *   teams.faction1.roster[]  and  teams.faction2.roster[]
 *
 * Each player object contains: nickname, player_id, game_player_id (SteamID64),
 * game_player_name, game_skill_level, membership, anticheat_required.
 */

import type { FaceitPlayer } from "./types.js";

/**
 * Extract players from a parsed FACEIT Data API match response.
 * Returns faction1 and faction2 arrays separately.
 * Returns empty arrays if the structure is unexpected.
 */
export function extractRoster(body: unknown): {
  faction1: FaceitPlayer[];
  faction2: FaceitPlayer[];
  matchStatus: string | null;
} {
  const empty = { faction1: [], faction2: [], matchStatus: null };

  if (!body || typeof body !== "object") return empty;

  const data = body as Record<string, unknown>;
  const matchStatus = typeof data.status === "string" ? data.status : null;
  const teams = data.teams;

  if (!teams || typeof teams !== "object") return empty;

  const teamsObj = teams as Record<string, unknown>;

  return {
    faction1: parseFaction(teamsObj.faction1),
    faction2: parseFaction(teamsObj.faction2),
    matchStatus,
  };
}

function parseFaction(faction: unknown): FaceitPlayer[] {
  if (!faction || typeof faction !== "object") return [];

  const f = faction as Record<string, unknown>;
  const roster = f.roster;

  if (!Array.isArray(roster)) return [];

  const teamName = typeof f.name === "string" ? f.name : null;

  return roster
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
    .map((p) => {
      const player: FaceitPlayer = {
        nickname: typeof p.nickname === "string" ? p.nickname : null,
        playerId: typeof p.player_id === "string" ? p.player_id : null,
        steamId64: typeof p.game_player_id === "string" ? p.game_player_id : null,
        steamName: typeof p.game_player_name === "string" ? p.game_player_name : null,
        level: typeof p.game_skill_level === "number" ? p.game_skill_level : null,
        membership: typeof p.membership === "string" ? p.membership : null,
        anticheatRequired: p.anticheat_required === true,
        team: teamName ?? null,
      };
      return player;
    });
}

/**
 * Validate that a roster result has the expected 5+5 players.
 */
export function isFullRoster(f1: FaceitPlayer[], f2: FaceitPlayer[]): boolean {
  return f1.length >= 5 && f2.length >= 5;
}

/**
 * Count total players across both factions.
 */
export function totalPlayers(f1: FaceitPlayer[], f2: FaceitPlayer[]): number {
  return f1.length + f2.length;
}
