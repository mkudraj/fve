/**
 * Match loader: fetches roster from FACEIT Data API with bounded retries.
 */

import { fetchMatchData, extractRoster, isRetryable } from "@fve/core";
import type { FaceitPlayer } from "@fve/core";

const RETRY_DELAYS_MS = [0, 500, 1500];

export interface LoadResult {
  faction1: FaceitPlayer[];
  faction2: FaceitPlayer[];
  matchStatus: string;
  elapsedMs: number;
}

/**
 * Load match roster with up to 3 attempts (immediate + 2 retries).
 * Retries only for 404, timeout, and 5xx.
 */
export async function loadMatchRoster(
  matchId: string,
  apiKey: string,
): Promise<LoadResult> {
  const startedAt = performance.now();

  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (i > 0) {
      await sleep(RETRY_DELAYS_MS[i]);
    }

    const res = await fetchMatchData(matchId, apiKey);

    if (res.ok && res.body) {
      const { faction1, faction2, matchStatus } = extractRoster(res.body);
      return {
        faction1,
        faction2,
        matchStatus: matchStatus ?? "unknown",
        elapsedMs: performance.now() - startedAt,
      };
    }

    // Don't retry auth errors or rate limits.
    if (!isRetryable(res.httpStatus)) {
      throw new LoadError(
        res.httpStatus === 401 || res.httpStatus === 403
          ? "AUTH_ERROR"
          : res.httpStatus === 429
            ? "RATE_LIMITED"
            : "API_ERROR",
        res.error ?? `HTTP ${res.httpStatus}`,
      );
    }

    // Last attempt - throw the 404/timeout as an error.
    if (i === RETRY_DELAYS_MS.length - 1) {
      throw new LoadError(
        res.httpStatus === 404 ? "NOT_FOUND" : "TIMEOUT",
        res.error ?? `HTTP ${res.httpStatus}`,
      );
    }
  }

  throw new LoadError("TIMEOUT", "All retries exhausted");
}

export class LoadError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LoadError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
