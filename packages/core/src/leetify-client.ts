/**
 * Leetify Public CS API client.
 *
 * Fetches player profiles to extract Aim Rating.
 *
 * Endpoints:
 *   GET /v3/profile?steam64_id=<STEAM_ID_64>
 *   GET /api-key/validate
 *
 * Base: https://api-public.cs-prod.leetify.com
 *
 * Security:
 *  - API key is never logged.
 *  - Key is passed via the _leetify_key header as recommended by the API docs.
 *  - Response bodies are not persisted to storage.
 */

const API_BASE = "https://api-public.cs-prod.leetify.com";

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
  reason?: "not-registered" | "private" | "not-found";
  retryAfterMs?: number;
  message?: string;
}

export interface LeetifyKeyValidation {
  valid: boolean;
  status: number;
  message: string;
}

// ---- Key validation ----

/** Validate a Leetify API key. */
export async function validateLeetifyKey(
  apiKey: string,
  timeoutMs: number = 8000,
): Promise<LeetifyKeyValidation> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/api-key/validate`, {
      headers: {
        _leetify_key: apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (res.status === 200) {
      return { valid: true, status: 200, message: "Key is valid." };
    }
    if (res.status === 401) {
      return { valid: false, status: 401, message: "Invalid or missing API key." };
    }
    if (res.status === 429) {
      return { valid: true, status: 429, message: "Rate limited. Key appears valid." };
    }
    if (res.status === 500) {
      return {
        valid: false,
        status: 500,
        message: "Leetify server error. Try again later.",
      };
    }
    return {
      valid: false,
      status: res.status,
      message: `Unexpected response: HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      valid: false,
      status: 0,
      message: (err as Error).name === "AbortError"
        ? "Request timed out."
        : `Network error: ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Profile fetch ----

/**
 * Fetch a Leetify player profile and extract the Aim Rating.
 *
 * Uses the steam64_id query parameter as confirmed by the current OpenAPI spec.
 */
export async function fetchLeetifyProfile(
  steamId64: string,
  apiKey: string,
  timeoutMs: number = 8000,
  signal?: AbortSignal,
): Promise<LeetifyProfileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Forward external abort signal if provided.
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const url = `${API_BASE}/v3/profile?steam64_id=${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, {
      headers: {
        _leetify_key: apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    // Auth errors
    if (res.status === 401 || res.status === 403) {
      return { status: "auth-error" };
    }

    // Rate limit
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      return {
        status: "rate-limited",
        retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
      };
    }

    // Profile not found or private
    if (res.status === 404) {
      return { status: "unavailable", reason: "not-found" };
    }

    // Server error
    if (res.status >= 500) {
      return {
        status: "temporary-error",
        message: `Leetify server error: HTTP ${res.status}`,
      };
    }

    // Unexpected status
    if (!res.ok) {
      return {
        status: "temporary-error",
        message: `Unexpected response: HTTP ${res.status}`,
      };
    }

    // Parse the profile
    const data = await res.json();

    // Check privacy mode
    if (data.privacy_mode && data.privacy_mode !== "public") {
      return { status: "unavailable", reason: "private" };
    }

    // Check for an actual player record (empty body or missing name suggests not registered)
    if (!data || (!data.rating && !data.name)) {
      return { status: "unavailable", reason: "not-registered" };
    }

    // Extract Aim Rating
    const aim = extractAimRating(data);
    if (aim === null) {
      return { status: "unavailable", reason: "not-registered" };
    }

    // Build profile URL
    const profileUrl = data.id
      ? `https://leetify.com/app/profile/${data.id}`
      : `https://leetify.com/app/profile/steam/${steamId64}`;

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
 * Extract the Aim Rating from a parsed ProfileResponse.
 * Returns null if rating.aim is not present or invalid.
 */
export function extractAimRating(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  const rating = obj.rating;

  if (!rating || typeof rating !== "object") return null;

  const aim = (rating as Record<string, unknown>).aim;

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
      return result.reason === "private"
        ? "Leetify profile private"
        : result.reason === "not-registered"
          ? "Player not registered on Leetify"
          : "Leetify profile not found";
    default:
      return "Unknown Leetify error";
  }
}
