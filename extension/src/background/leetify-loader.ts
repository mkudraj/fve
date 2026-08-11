/**
 * Leetify background loader.
 *
 * Fetches Aim Ratings + Match Stats for all players in a roster
 * with controlled concurrency. Updates the state progressively.
 */

import { fetchLeetifyProfile, fetchRecentMatchStats } from "@fve/core";
import type {
  FaceitPlayer,
  AimRatingState,
  AimTiming,
} from "@fve/core";

const CONCURRENCY = 4;
const TIMEOUT_MS = 8000;

/** Map result to AimRatingState. */
function toAimState(
  result: Awaited<ReturnType<typeof fetchLeetifyProfile>>,
): AimRatingState {
  switch (result.status) {
    case "success":
      return {
        status: "available",
        value: result.aim!,
        profileUrl: result.profileUrl,
      };
    case "unavailable":
      return {
        status: "unavailable",
        reason: result.reason ?? "not-found",
      };
    case "rate-limited":
      return { status: "rate-limited" };
    case "auth-error":
    case "temporary-error":
      return {
        status: "error",
        message: result.message ?? "Leetify fetch failed",
      };
    default:
      return { status: "error", message: "Unknown error" };
  }
}

/**
 * Load Aim Ratings for all players with concurrency control.
 *
 * Each player gets aim = { status: "loading" } immediately,
 * then profiles are fetched with CONCURRENCY parallel requests.
 * After each response, onUpdate is called with the updated player.
 */
export async function loadAimRatings(
  /** All players from both factions (10 elements). */
  players: FaceitPlayer[],
  leetifyKey: string,
  /** Called after each player's aim is resolved. Receives the updated player. */
  onUpdate: (player: FaceitPlayer) => void,
  /** Optional abort signal for cancelling the entire batch (new match). */
  signal?: AbortSignal,
): Promise<AimTiming> {
  const timing: AimTiming = {
    requestsStartedAt: Date.now(),
    firstAimLoadedAt: null,
    allAimRequestsFinishedAt: null,
    availableAimCount: 0,
    unavailableAimCount: 0,
    errorAimCount: 0,
  };

  // Filter players with valid SteamID64.
  const targets = players.filter(
    (p): p is FaceitPlayer & { steamId64: string } => !!p.steamId64,
  );

  if (targets.length === 0) {
    timing.allAimRequestsFinishedAt = Date.now();
    return timing;
  }

  // Set all to "loading".
  for (const p of players) {
    if (p.steamId64) {
      p.aim = { status: "loading" };
    } else {
      p.aim = { status: "unavailable", reason: "missing-steam-id" };
    }
  }

  // Concurrency-limited queue.
  const queue = [...targets];
  let active = 0;
  let completed = 0;
  const total = targets.length;

  async function processNext() {
    while (queue.length > 0 && !signal?.aborted) {
      const player = queue.shift()!;
      active++;

      try {
        const result = await fetchLeetifyProfile(
          player.steamId64,
          leetifyKey,
          TIMEOUT_MS,
          signal,
        );
        player.aim = toAimState(result);

        // Update timing counters.
        if (result.status === "success") timing.availableAimCount++;
        else if (result.status === "unavailable") timing.unavailableAimCount++;
        else timing.errorAimCount++;

        if (timing.firstAimLoadedAt === null) {
          timing.firstAimLoadedAt = Date.now();
        }

        onUpdate(player);

        // Fetch recent match stats from Leetify (last 20 FACEIT matches).
        if (result.status === "success") {
          try {
            const stats = await fetchRecentMatchStats(
              player.steamId64,
              leetifyKey,
              20,
              TIMEOUT_MS,
              signal,
            );
            if (stats) {
              player.matchStats = {
                status: "available",
                stats: {
                  matchesAnalyzed: stats.matchesAnalyzed,
                  totalMatches: stats.totalMatches,
                  winRate: stats.winRate,
                  kdRatio: stats.kdRatio,
                  killsPerRound: stats.killsPerRound,
                  adr: stats.adr,
                  kills: stats.kills,
                  deaths: stats.deaths,
                  assists: stats.assists,
                  leetifyProfileUrl: null,
                  avgRating: stats.avgRating,
                  ratingSwing: stats.ratingSwing,
                  last24h: stats.last24h,
                },
              };
            } else {
              player.matchStats = { status: "unavailable" };
            }
          } catch {
            player.matchStats = { status: "unavailable" };
          }
          onUpdate(player);
        }
      } catch {
        player.aim = {
          status: "error",
          message: "Unexpected fetch error",
        };
        timing.errorAimCount++;
        onUpdate(player);
      } finally {
        active--;
        completed++;
      }
    }
  }

  // Start concurrent workers.
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () =>
    processNext(),
  );
  await Promise.all(workers);

  timing.allAimRequestsFinishedAt = Date.now();
  return timing;
}
