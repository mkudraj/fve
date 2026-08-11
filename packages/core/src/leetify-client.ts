/**
 * Leetify internal API client.
 *
 * Uses the same API that the Leetify web app calls (no auth required for public profiles).
 *
 * Endpoints:
 *   GET https://api.cs-prod.leetify.com/api/profile/id/<STEAM_ID_64>
 *
 * The response contains recentGameRatings.aim and a games[] array with match history.
 */

const API_BASE = "https://api.cs-prod.leetify.com";

// ---- Types ----

export interface LeetifyProfileResult {
  status:
    | "success"
    | "unavailable"
    | "rate-limited"
    | "auth-error"
    | "temporary-error";
  aim?: number;
  profileUrl?: string;
  reason?: "not-found";
  retryAfterMs?: number;
  message?: string;
}

export interface LeetifyKeyValidation {
  valid: boolean;
  status: number;
  message: string;
}

// ---- Key validation ----

/** Validate a Leetify API key (always returns valid - internal API doesn't require a key). */
export async function validateLeetifyKey(
  _apiKey: string,
  _timeoutMs: number = 8000,
): Promise<LeetifyKeyValidation> {
  // The internal API doesn't need a key for public profile lookups.
  // Still accept a key parameter for backward compatibility.
  return { valid: true, status: 200, message: "No API key required." };
}

// ---- Profile fetch ----

/**
 * Fetch a Leetify player profile and extract the Aim Rating.
 *
 * Uses the internal Leetify API (same as the web app).
 * No authentication required for public profile lookups.
 */
export async function fetchLeetifyProfile(
  steamId64: string,
  _apiKey?: string,
  timeoutMs: number = 8000,
  signal?: AbortSignal,
): Promise<LeetifyProfileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const url = `${API_BASE}/api/profile/id/${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { status: "unavailable", reason: "not-found" };
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      return {
        status: "rate-limited",
        retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
      };
    }

    if (res.status >= 500) {
      return {
        status: "temporary-error",
        message: `Leetify server error: HTTP ${res.status}`,
      };
    }

    if (!res.ok) {
      return {
        status: "temporary-error",
        message: `Unexpected response: HTTP ${res.status}`,
      };
    }

    const data = await res.json();

    if (!data || typeof data !== "object") {
      return { status: "unavailable", reason: "not-found" };
    }

    const aim = extractAimRating(data);
    if (aim === null) {
      return { status: "unavailable", reason: "not-found" };
    }

    const profileUrl = `https://leetify.com/public/profile/${steamId64}`;

    return { status: "success", aim, profileUrl };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return {
        status: "temporary-error",
        message: signal?.aborted ? "Request cancelled." : "Request timed out.",
      };
    }
    return {
      status: "temporary-error",
      message: `Network error: ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract the Aim Rating from a parsed internal API profile response.
 * Looks for recentGameRatings.aim (the same data shown on the Leetify profile page).
 * Returns null if not present or invalid.
 */
export function extractAimRating(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  const ratings = obj.recentGameRatings;

  if (!ratings || typeof ratings !== "object") return null;

  const aim = (ratings as Record<string, unknown>).aim;

  if (typeof aim !== "number") return null;
  if (!Number.isFinite(aim)) return null;

  return aim;
}

/**
 * Classify a Leetify error into a user-friendly reason.
 */
export function classifyLeetifyError(
  result: LeetifyProfileResult,
): string {
  switch (result.status) {
    case "auth-error":
      return "Leetify API key invalid";
    case "rate-limited":
      return "Leetify rate limited";
    case "temporary-error":
      return result.message ?? "Leetify temporary error";
    case "unavailable":
      return "Leetify profile not found";
    default:
      return "Unknown Leetify error";
  }
}

// ---- Recent match stats aggregation (last 20 FACEIT matches) ----

export interface RecentMatchStats {
  matchesAnalyzed: number;
  totalMatches: number;
  winRate: number | null;
  kdRatio: number | null;       // K/D
  killsPerRound: number | null;  // K/R
  adr: number | null;            // ADR
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  avgRating: number | null;      // Average Leetify rating
  ratingSwing: number | null;    // Latest rating - oldest rating (% change)
  last24h: { games: number; label: string; detail: string } | null;
}

interface PerMatchData {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rounds: number;
  won: boolean;
  rating: number | null;
  finishedAt: string | null;
}

/**
 * Fetch recent FACEIT match stats for a player via the internal Leetify API.
 * Aggregates the last N FACEIT-only matches from the games[] array.
 */
export async function fetchRecentMatchStats(
  steamId64: string,
  _apiKey?: string,
  maxMatches: number = 20,
  timeoutMs: number = 10000,
  signal?: AbortSignal,
): Promise<RecentMatchStats | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  try {
    const url = `${API_BASE}/api/profile/id/${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    const games = data.games;
    if (!Array.isArray(games) || games.length === 0) return null;

    // Filter FACEIT only, take last N.
    const faceitGames = (games as Array<Record<string, unknown>>)
      .filter((g) => g.dataSource === "faceit");
    const recent = faceitGames.slice(0, maxMatches);
    if (recent.length === 0) return null;

    // Extract per-match data.
    const perMatch: PerMatchData[] = [];
    for (const game of recent) {
      const pm = extractPerMatchFromGame(game, steamId64);
      if (pm) perMatch.push(pm);
    }
    if (perMatch.length === 0) return null;

    // Aggregate.
    let totalKills = 0, totalDeaths = 0, totalAssists = 0;
    let wins = 0;
    let totalRating = 0, ratingCount = 0;

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    let last24hGames = 0;
    const last24hRatings: number[] = [];

    for (const m of perMatch) {
      totalKills += m.kills;
      totalDeaths += m.deaths;
      totalAssists += m.assists;
      if (m.won) wins++;
      if (m.rating !== null) {
        totalRating += m.rating;
        ratingCount++;
      }

      if (m.finishedAt) {
        const finishedMs = new Date(m.finishedAt).getTime();
        if (now - finishedMs <= DAY_MS) {
          last24hGames++;
          if (m.rating !== null) last24hRatings.push(m.rating);
        }
      }
    }

    // Rating swing: first match is newest, last is oldest (API returns newest first).
    const oldestRating = perMatch[perMatch.length - 1].rating;
    const newestRating = perMatch[0].rating;
    const ratingSwing =
      oldestRating !== null && newestRating !== null
        ? newestRating - oldestRating
        : null;

    // Last 24h performance.
    let last24h: RecentMatchStats["last24h"] = null;
    if (last24hGames > 0 && last24hRatings.length >= 3) {
      const avg = last24hRatings.reduce((a, b) => a + b, 0) / last24hRatings.length;
      const variance =
        last24hRatings.reduce((sum, r) => sum + (r - avg) ** 2, 0) /
        last24hRatings.length;
      const stdDev = Math.sqrt(variance);
      const consistent = stdDev < 0.08;
      last24h = {
        games: last24hGames,
        label: consistent ? "consistent" : "inconsistent",
        detail: consistent
          ? `playing consistently across ${last24hGames} games`
          : `performing inconsistently across ${last24hGames} games`,
      };
    } else if (last24hGames > 0) {
      last24h = {
        games: last24hGames,
        label: "low-data",
        detail: `only ${last24hGames} game${last24hGames > 1 ? "s" : ""} in last 24h`,
      };
    }

    return {
      matchesAnalyzed: perMatch.length,
      totalMatches: faceitGames.length,
      winRate: perMatch.length > 0 ? wins / perMatch.length : null,
      kdRatio: totalDeaths > 0 ? totalKills / totalDeaths : null,
      killsPerRound: null, // not available from internal API
      adr: null,            // not available from internal API
      kills: totalKills,
      deaths: totalDeaths,
      assists: totalAssists,
      avgRating: ratingCount > 0 ? totalRating / ratingCount : null,
      ratingSwing,
      last24h,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract per-match data from an internal API game object.
 */
function extractPerMatchFromGame(
  game: Record<string, unknown>,
  steamId64: string,
): PerMatchData | null {
  const kills = typeof game.kills === "number" ? game.kills : 0;
  const deaths = typeof game.deaths === "number" ? game.deaths : 0;
  const assists = 0; // not available from internal API

  // Extract player's rating from ownTeamTotalLeetifyRatings.
  let rating: number | null = null;
  const ratings = game.ownTeamTotalLeetifyRatings;
  if (ratings && typeof ratings === "object") {
    const r = (ratings as Record<string, unknown>)[steamId64];
    if (typeof r === "number") rating = r;
  }

  const finishedAt =
    typeof game.gameFinishedAt === "string" ? game.gameFinishedAt : null;

  const won = game.matchResult === "win";

  return { kills, deaths, assists, damage: 0, rounds: 0, won, rating, finishedAt };
}

