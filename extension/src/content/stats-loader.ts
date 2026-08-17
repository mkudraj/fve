/**
 * FACEIT stats loader (content script).
 *
 * Fetches the FACEIT roster stats (Overall Matches + Last 20 Matches) via
 * FACEIT's internal site API. This MUST run from the content script because the
 * endpoint is behind Cloudflare and only answers same-origin (on
 * www.faceit.com) with the browser's session - same approach as the Repeek
 * extension. It does NOT work from the background worker or curl.
 *
 * Updates each player's `matchStats` progressively with bounded concurrency.
 */

import { fetchFaceitPlayerStats } from "@fve/core";
import type { FaceitPlayer, MatchStats } from "@fve/core";

const CONCURRENCY = 4;
const TIMEOUT_MS = 8000;

/**
 * Load FACEIT stats for the given players with concurrency control.
 * Sets each player to `loading` first, then resolves one by one.
 * Calls `onUpdate(player)` after each player is resolved.
 */
export async function loadFaceitStats(
  players: FaceitPlayer[],
  onUpdate: (player: FaceitPlayer) => void,
  signal?: AbortSignal,
): Promise<void> {
  const targets = players.filter(
    (p): p is FaceitPlayer & { playerId: string } => !!p.playerId,
  );

  // Mark all as loading (players without a FACEIT id -> unavailable).
  for (const p of players) {
    p.matchStats = p.playerId
      ? { status: "loading" }
      : { status: "unavailable" };
  }

  if (targets.length === 0) return;

  const queue = [...targets];

  async function worker() {
    while (queue.length > 0 && !signal?.aborted) {
      const player = queue.shift()!;
      try {
        const stats = await fetchFaceitPlayerStats(
          player.playerId,
          TIMEOUT_MS,
          signal,
        );
        player.matchStats = stats
          ? { status: "available", stats }
          : { status: "unavailable" };
      } catch {
        player.matchStats = { status: "unavailable" };
      }
      onUpdate(player);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  );
}

/** Keep stats for players across background state re-broadcasts. */
export class StatsCache {
  private map = new Map<string, MatchStats>();

  has(playerId: string): boolean {
    return this.map.has(playerId);
  }

  set(playerId: string, stats: MatchStats): void {
    this.map.set(playerId, stats);
  }

  /**
   * Re-apply cached stats onto a freshly received state (by playerId).
   * Players with a FACEIT id that are still missing (and a load is in flight)
   * are marked as "loading" so the UI keeps showing the spinner.
   */
  apply(
    state: { faction1: FaceitPlayer[]; faction2: FaceitPlayer[] },
    inFlight: boolean,
  ): void {
    for (const p of [...state.faction1, ...state.faction2]) {
      if (p.playerId && this.map.has(p.playerId)) {
        p.matchStats = { status: "available", stats: this.map.get(p.playerId)! };
      } else if (inFlight && p.playerId && !p.matchStats) {
        p.matchStats = { status: "loading" };
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}
