/**
 * Roster detection and player extraction from match payloads.
 *
 * A roster is only "found" when a collection actually contains player objects.
 * A bare boolean field like `rosterWithSubstitutes: false` is NOT a roster and
 * must be ignored.
 */

export interface RosterPlayer {
  nickname: string | null;
  playerId: string | null;
  gamePlayerId: string | null;
  steamId64: string | null;
  team: string | null;
  jsonPath: string;
}

export interface RosterResult {
  /** true only if at least one real player object was found. */
  found: boolean;
  players: RosterPlayer[];
  /** JSON paths of collections that held the players. */
  containerPaths: string[];
  /** Timestamp of the response (from the caller). */
  timestamp: string;
}

// Key that may resolve to a player object/collection elsewhere in the payload.
const ROSTER_KEYS = [
  "teams",
  "faction1",
  "faction2",
  "faction",
  "roster",
  "players",
  "members",
  "team",
];

const NICKNAME_KEYS = ["nickname", "nick"];
const PLAYER_ID_KEYS = ["player_id", "playerid", "playerId", "guid"];
const GAME_PLAYER_ID_KEYS = ["game_player_id", "gameplayerid"];
const STEAM_KEYS = ["steam_id_64", "steamid64", "steam_id"];
const TEAM_KEYS = ["team", "faction", "team_id"];

/**
 * Determine whether a JSON value is a "player object" — has at least a
 * recognizable identity field (nickname / id / steam id).
 */
function looksLikePlayer(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  return keys.some((k) => NICKNAME_KEYS.includes(k) || PLAYER_ID_KEYS.includes(k) || GAME_PLAYER_ID_KEYS.includes(k) || STEAM_KEYS.includes(k));
}

/** Find the best identity field in a player object. */
function identityOf(prefixKey: string, obj: Record<string, unknown>): string | null {
  const lower = prefixKey.toLowerCase();
  const exact = obj[lower];
  if (typeof exact === "string" && exact) return exact;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower && typeof obj[k] === "string" && obj[k]) {
      return obj[k] as string;
    }
  }
  return null;
}

/**
 * Recursively walk a parsed JSON document and pull out player objects that sit
 * under roster-like keys, returning them with their JSON paths.
 */
export function analyzeRoster(
  parsed: unknown,
  timestamp: string,
): RosterResult {
  const players: RosterPlayer[] = [];
  const containerPaths: string[] = [];
  const seen = new Set<string>();

  function walk(
    node: unknown,
    path: string,
    contextTeam: string | null,
    depth: number,
  ): void {
    if (depth > 25) return;
    if (node === null || node === undefined) return;

    if (Array.isArray(node)) {
      // An array under a roster-ish key -> treat items as players.
      const parentKey = path.split(".").pop()?.toLowerCase() ?? "";
      const isRosterContainer = ROSTER_KEYS.some((k) => parentKey === k || parentKey.includes(k));
      for (let i = 0; i < node.length; i++) {
        const item = node[i];
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const itemPath = `${path}[${i}]`;
          if (isRosterContainer && looksLikePlayer(item as Record<string, unknown>)) {
            const key = JSON.stringify(item);
            if (seen.has(key)) continue;
            seen.add(key);
            players.push(buildPlayer(item as Record<string, unknown>, itemPath, contextTeam));
            containerPaths.push(path);
          } else {
            walk(item, itemPath, contextTeam, depth + 1);
          }
        }
      }
      // Also recurse into objects inside arrays that may be teams holding rosters.
      node.forEach((item, i) => walk(item, `${path}[${i}]`, contextTeam, depth + 1));
      return;
    }

    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key;
        const lower = key.toLowerCase();

        // Detect a player object directly (has nickname/id) under a roster key.
        if (
          (value && typeof value === "object" && !Array.isArray(value)) &&
          looksLikePlayer(value as Record<string, unknown>)
        ) {
          const k = JSON.stringify(value);
          if (!seen.has(k)) {
            seen.add(k);
            players.push(buildPlayer(value as Record<string, unknown>, newPath, contextTeam));
            containerPaths.push(newPath);
          }
          continue;
        }

        // Set team context from a recognized team key that holds a scalar id/name.
        let childTeam = contextTeam;
        if (TEAM_KEYS.includes(lower) && typeof value === "string") {
          childTeam = value;
        }

        walk(value, newPath, childTeam, depth + 1);
      }
    }
  }

  // Roster-like containers may appear at top level.
  walk(parsed, "", null, 0);

  return { found: players.length > 0, players, containerPaths, timestamp };
}

function buildPlayer(obj: Record<string, unknown>, jsonPath: string, team: string | null): RosterPlayer {
  let nickname: string | null = null;
  for (const k of NICKNAME_KEYS) {
    nickname = identityOf(k, obj) ?? nickname;
  }
  let playerId: string | null = null;
  for (const k of PLAYER_ID_KEYS) {
    playerId = identityOf(k, obj) ?? playerId;
  }
  let gamePlayerId: string | null = null;
  for (const k of GAME_PLAYER_ID_KEYS) {
    gamePlayerId = identityOf(k, obj) ?? gamePlayerId;
  }
  let steamId64: string | null = null;
  for (const k of STEAM_KEYS) {
    steamId64 = identityOf(k, obj) ?? steamId64;
  }
  // The Data API exposes the player's SteamID64 as `game_player_id`.
  if (!steamId64) {
    steamId64 = identityOf("game_player_id", obj);
  }
  const teamId = identityOf("team", obj) ?? identityOf("faction", obj) ?? team;

  return { nickname, playerId, gamePlayerId, steamId64, team: teamId, jsonPath };
}

/**
 * Convenience: extract roster from a raw JSON string; returns {found, players}
 */
export function analyzeRosterFromJson(
  body: string,
  timestamp: string,
): RosterResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { found: false, players: [], containerPaths: [], timestamp };
  }
  return analyzeRoster(parsed, timestamp);
}
