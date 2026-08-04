/**
 * FACEIT Data API client.
 *
 * Fetches match data from the official public endpoint:
 *   GET https://open.faceit.com/data/v4/matches/{matchId}
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

const API_BASE = "https://open.faceit.com/data/v4/matches";

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
    const res = await fetch(`${API_BASE}/${encodeURIComponent(matchId)}`, {
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
