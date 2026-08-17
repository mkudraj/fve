/**
 * Leetify internal API client.
 *
 * Uses the same API that the Leetify web app calls (no auth required for public profiles).
 *
 * Endpoints (current Leetify site, as of the 2026 profile redesign):
 *   GET https://api.cs-prod.leetify.com/api/profile/<STEAM_ID_64>/recent-games/5v5
 *     Aggregate stats over the last ~30 matches (contains the top-level `aimRating` field).
 *   GET https://api.cs-prod.leetify.com/api/profile/<STEAM_ID_64>/match-history
 *     Last ~12 games with per-match rating (`leetifyRating`), kills, deaths and result.
 *
 * The old endpoint /api/profile/id/<STEAM_ID_64> (which returned
 * recentGameRatings.aim + a games[] array) was removed in the redesign.
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
    const url = `${API_BASE}/api/profile/${encodeURIComponent(steamId64)}/recent-games/5v5`;
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

    // The new API returns aimRating with many decimals (e.g. 89.7957...).
    // Round to 1 decimal so the overlay/profiles page stays clean.
    const roundedAim = Math.round(aim * 10) / 10;

    return { status: "success", aim: roundedAim, profileUrl };
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
 *
 * Current Leetify format (recent-games/5v5) exposes a top-level `aimRating`
 * field (0-100 score). Falls back to the legacy `recentGameRatings.aim` shape.
 * Returns null if not present or invalid.
 */
export function extractAimRating(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // New format: top-level aimRating.
  const aimRating = obj.aimRating;
  if (typeof aimRating === "number" && Number.isFinite(aimRating)) {
    return aimRating;
  }

  // Legacy format: recentGameRatings.aim.
  const ratings = obj.recentGameRatings;
  if (ratings && typeof ratings === "object") {
    const aim = (ratings as Record<string, unknown>).aim;
    if (typeof aim === "number" && Number.isFinite(aim)) {
      return aim;
    }
  }

  return null;
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

// Note: Leetify is used ONLY for the Aim Rating. Match stats (matches, win
// rate, ADR, HS%, K/D, K/R) come from FACEIT's own stats API - see
// faceit-stats.ts for the implementation.

