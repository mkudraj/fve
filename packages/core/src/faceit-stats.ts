/**
 * FACEIT internal site stats client.
 *
 * Fetches the same player stats FACEIT shows in the roster widget
 * (RosterPlayerStatsV2: Overall Matches + Last 20 Matches) from FACEIT's
 * internal API - the same approach the Repeek extension uses:
 *
 *   GET https://www.faceit.com/api/stats/v1/stats/users/{playerId}/games/{game}
 *       -> lifetime stats (total matches in `lifetime.m1`)
 *   GET https://www.faceit.com/api/stats/v1/stats/time/users/{playerId}/games/{game}?size=20
 *       -> per-match stats for the last 20 matches
 *
 * IMPORTANT: this endpoint sits behind Cloudflare and only answers with the
 * browser's session/cookies, so it MUST be called same-origin from the content
 * script (on www.faceit.com), exactly like the FACEIT site does. It does NOT
 * work from curl or a plain background fetch.
 *
 * Field mapping (verified against the live API):
 *   c2           = K/D ratio
 *   c3           = K/R ratio
 *   c4           = Headshot %
 *   c10          = ADR (average damage per round)
 *   i2 === teamId -> the player's team won that match
 *   lifetime.m1  = total matches played
 */

const SITE_API = "https://www.faceit.com/api";
const GAME = "cs2";

/** Aggregated FACEIT player stats (matches + last 20 matches averages). */
export interface FaceitMatchStats {
  /** Number of 5v5 matches analyzed (last 20 window). */
  matchesAnalyzed: number;
  /** Overall lifetime matches count. */
  totalMatches: number;
  /** Win rate over the analyzed matches (0..1). */
  winRate: number | null;
  /** Average K/D ratio. */
  kdRatio: number | null;
  /** Average K/R ratio. */
  killsPerRound: number | null;
  /** Average ADR (damage per round). */
  adr: number | null;
  /** Average Headshot %. */
  headshotRate: number | null;
}

/**
 * Fetch a player's FACEIT stats via the internal site API.
 * Returns null when the player has no 5v5 data or the API is unavailable.
 */
export async function fetchFaceitPlayerStats(
  playerId: string,
  timeoutMs: number = 8000,
  signal?: AbortSignal,
): Promise<FaceitMatchStats | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  try {
    const [lifetimeRes, timeRes] = await Promise.all([
      fetch(
        `${SITE_API}/stats/v1/stats/users/${encodeURIComponent(playerId)}/games/${GAME}`,
        {
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        },
      ),
      fetch(
        `${SITE_API}/stats/v1/stats/time/users/${encodeURIComponent(playerId)}/games/${GAME}?size=20`,
        {
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        },
      ),
    ]);

    if (!lifetimeRes.ok || !timeRes.ok) return null;

    const lifetime = (await lifetimeRes.json()) as {
      lifetime?: Record<string, unknown>;
    };
    const time = (await timeRes.json()) as unknown;

    return parseFaceitStats(lifetime, time);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the two FACEIT stats responses into an aggregated result.
 * Pure function - easily unit tested.
 */
export function parseFaceitStats(
  lifetime: { lifetime?: Record<string, unknown> } | null | undefined,
  time: unknown,
): FaceitMatchStats | null {
  if (!Array.isArray(time)) return null;

  const raw = time as Array<Record<string, unknown>>;

  // Only 5v5 matches (the widget's "Last 20 Matches").
  const fivev5 = raw.filter((m) => {
    if (!m || typeof m !== "object") return false;
    const gameMode = m.gameMode;
    return typeof gameMode === "string" && gameMode.includes("5v5");
  });

  if (fivev5.length === 0) return null;

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const avg = (key: string): number | null => {
    const vals = fivev5
      .map((m) => num(m[key]))
      .filter((n): n is number => n !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const wins = fivev5.filter((m) => m.i2 === m.teamId).length;
  const totalMatches = num(lifetime?.lifetime?.m1);

  return {
    matchesAnalyzed: fivev5.length,
    totalMatches: totalMatches ?? fivev5.length,
    winRate: fivev5.length > 0 ? wins / fivev5.length : null,
    kdRatio: avg("c2"),
    killsPerRound: avg("c3"),
    adr: avg("c10"),
    headshotRate: avg("c4"),
  };
}
