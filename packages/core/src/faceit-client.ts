/**
 * FACEIT Data API client.
 *
 * Fetches match data and player stats from the official public API:
 *   GET https://open.faceit.com/data/v4/matches/{matchId}
 *   GET https://open.faceit.com/data/v4/players/{playerId}/stats/cs2
 *
 * Security:
 *  - The API key is received as a parameter, never read from env in the extension.
 *  - The Authorization header is never logged.
 */

export interface DataApiResponse {
  matchId: string;
  httpStatus: number;
  ok: boolean;
  body: unknown;
  error: string | null;
  elapsedMs: number;
}

/** Aggregated FACEIT player stats for CS2. */
export interface FaceitPlayerStats {
  playerId: string;
  kdRatio: number | null;
  krRatio: number | null;
  headshotRate: number | null;
  winRate: number | null;
  matches: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  adr: number | null;
}

const API_BASE = "https://open.faceit.com/data/v4";

/**
 * Fetch match data from the FACEIT Data API.
 * Returns the parsed JSON body on success, or an error classification.
 */
export async function fetchMatchData(
  matchId: string,
  apiKey: string,
  timeoutMs: number = 8000,
): Promise<DataApiResponse> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/matches/${encodeURIComponent(matchId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON response, body stays null
    }

    return {
      matchId,
      httpStatus: res.status,
      ok: res.ok,
      body,
      error: null,
      elapsedMs: performance.now() - startedAt,
    };
  } catch (err) {
    return {
      matchId,
      httpStatus: 0,
      ok: false,
      body: null,
      error: (err as Error).message || "Network error",
      elapsedMs: performance.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classify a Data API HTTP status into a semantic result code.
 */
export function classifyApiStatus(httpStatus: number): string {
  if (httpStatus === 200) return "OK";
  if (httpStatus === 401 || httpStatus === 403) return "AUTH_ERROR";
  if (httpStatus === 404) return "NOT_FOUND";
  if (httpStatus === 429) return "RATE_LIMITED";
  if (httpStatus >= 500) return "SERVER_ERROR";
  return "UNEXPECTED";
}

/**
 * Determine whether a status is retryable.
 */
export function isRetryable(httpStatus: number): boolean {
  return httpStatus === 404 || httpStatus === 0 || httpStatus >= 500;
}

/**
 * Fetch a player's CS2 stats from FACEIT Data API.
 * Returns aggregated lifetime stats.
 */
export async function fetchPlayerStats(
  playerId: string,
  apiKey: string,
  timeoutMs: number = 8000,
  signal?: AbortSignal,
): Promise<FaceitPlayerStats | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(
      `${API_BASE}/players/${encodeURIComponent(playerId)}/stats/cs2`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    // FACEIT stats response contains various lifetime/segment data.
    // Extract the most relevant aggregated fields.
    const lifetime = data.lifetime;
    const lifetimeObj = lifetime && typeof lifetime === "object"
      ? lifetime as Record<string, unknown>
      : null;

    return {
      playerId,
      kdRatio: parseNum(lifetimeObj?.["Average K/D Ratio"]),
      krRatio: parseNum(lifetimeObj?.["Average K/R Ratio"]),
      headshotRate: parseNum(lifetimeObj?.["Average Headshots %"]),
      winRate: parseNum(lifetimeObj?.["Win Rate %"]),
      matches: parseNum(lifetimeObj?.["Matches"]),
      avgKills: parseNum(lifetimeObj?.["Average Kills"]),
      avgDeaths: parseNum(lifetimeObj?.["Average Deaths"]),
      avgAssists: parseNum(lifetimeObj?.["Average Assists"]),
      adr: null, // ADR not directly in FACEIT lifetime stats; can compute from segments
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseNum(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
