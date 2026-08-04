/**
 * FACEIT Data API client (official: open.faceit.com/data/v4/matches/{matchId}).
 *
 * Security:
 *  - The Authorization header is built from FACEIT_API_KEY but is NEVER logged.
 *  - Response bodies are sanitized before being persisted.
 *  - Only the official documented endpoint is used; we never send manual
 *    requests to undocumented internal endpoints with the user's tokens.
 */

export interface DataApiResult {
  matchId: string;
  phase: "pre_accept" | "post_accept_immediate" | "post_accept_delayed";
  requestTimestamp: string;
  responseTimestamp: string;
  httpStatus: number;
  ok: boolean;
  sanitizedBody: string | null;
  rawParsed: unknown;
  error: string | null;
}

const API_BASE = "https://open.faceit.com/data/v4/matches";

export function getApiKey(): string {
  return process.env.FACEIT_API_KEY || "";
}

export async function fetchMatchData(
  matchId: string,
  phase: DataApiResult["phase"],
  opts: {
    apiKey?: string;
    timeoutMs?: number;
    sanitizeBody?: (body: string) => string;
  } = {},
): Promise<DataApiResult> {
  const apiKey = opts.apiKey ?? getApiKey();
  const timeoutMs = opts.timeoutMs ?? 10000;

  const requestTimestamp = new Date().toISOString();
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
    const responseTimestamp = new Date().toISOString();

    const sanitize = opts.sanitizeBody ?? ((b: string) => b);
    let sanitizedBody: string | null = null;
    let rawParsed: unknown = null;

    try {
      rawParsed = text ? JSON.parse(text) : null;
      sanitizedBody = sanitize(text);
    } catch {
      sanitizedBody = sanitize(text);
    }

    return {
      matchId,
      phase,
      requestTimestamp,
      responseTimestamp,
      httpStatus: res.status,
      ok: res.ok,
      sanitizedBody,
      rawParsed,
      error: null,
    };
  } catch (err) {
    const responseTimestamp = new Date().toISOString();
    return {
      matchId,
      phase,
      requestTimestamp,
      responseTimestamp,
      httpStatus: 0,
      ok: false,
      sanitizedBody: null,
      rawParsed: null,
      error: (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Semantic classification of a Data API result.
 */
export function classifyDataApiResult(r: DataApiResult): string {
  if (r.httpStatus === 200) {
    return "API_200";
  }
  if (r.httpStatus === 401 || r.httpStatus === 403) {
    return "INCONCLUSIVE_API_AUTH_ERROR";
  }
  if (r.httpStatus === 404) {
    return "DATA_API_MATCH_NOT_PUBLIC_BEFORE_ACCEPT";
  }
  if (r.httpStatus === 429) {
    return "API_RATE_LIMITED";
  }
  return "API_UNEXPECTED_STATUS";
}
