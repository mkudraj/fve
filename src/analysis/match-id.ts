/**
 * Match ID detection.
 *
 * FACEIT match IDs may carry a prefix (e.g. `1-`), as in:
 *   1-ed06863c-ee54-4fe1-9278-475d72991017
 *
 * The FULL identifier is preserved (including the `1-` prefix) so that the
 * Data API `/data/v4/matches/{matchId}` receives the correct value.
 */

// UUID body (36 chars incl. hyphens) optionally preceded by a numeric prefix
// like "1-". Pattern intentionally flexible for future prefix formats.
export const MATCH_ID_WITH_PREFIX = /\b\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Plain UUID (no prefix). NOTE: a bare UUID is NOT a valid matchId for the
// FACEIT Data API — it is often a community_id / lobby id / other entity.
// Requiring the `\d+-` prefix avoids false positives like community_id.
export const MATCH_ID_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export interface MatchIdDetection {
  /** ISO timestamp when first seen. */
  timestamp: string;
  /** Full matchId (including the required "1-" prefix). */
  matchId: string;
  /** Human-readable source, e.g. "url", "responseBody", "wsFrame", "dom". */
  source: string;
  /** The NetworkEvent url that contained the id. */
  url: string;
}

/**
 * Scans text for a FACEIT match id.
 *
 * Only the PREFIXED form (e.g. `1-xxxxxxxx-...`) is accepted as a matchId.
 * A bare UUID is NOT returned: in real traffic a bare UUID is frequently a
 * community_id (e.g. `searchCommunityLobbies?community_id=...`) or another
 * entity id, and querying the Data API with it yields 404.
 */
export function extractMatchId(text: string): string | null {
  if (!text) return null;
  const prefixed = text.match(MATCH_ID_WITH_PREFIX);
  return prefixed ? prefixed[0] : null;
}

/**
 * Detect a matchId within a captured event's url, response body or ws frame.
 */
export function detectMatchId(event: {
  timestamp: string;
  url: string;
  responseBody?: string;
  wsFrameData?: string;
}): MatchIdDetection | null {
  const candidates: Array<[string, string]> = [];

  if (event.url) candidates.push(["url", event.url]);
  if (event.responseBody) candidates.push(["responseBody", event.responseBody]);
  if (event.wsFrameData) candidates.push(["wsFrame", event.wsFrameData]);

  for (const [source, text] of candidates) {
    const matchId = extractMatchId(text);
    if (matchId) {
      return {
        timestamp: event.timestamp,
        matchId,
        source,
        url: event.url,
      };
    }
  }

  return null;
}
