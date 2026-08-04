/**
 * Match ID detection for FACEIT matchmaking.
 *
 * FACEIT match IDs carry a numeric prefix (e.g. "1-") followed by a UUID.
 * The FULL identifier (including prefix) is required for the Data API.
 * Bare UUIDs (e.g. community_id) must be rejected as false positives.
 */

/** Regex matching a matchId with numeric prefix (e.g. "1-xxxxxxxx-..."). */
export const MATCH_ID_WITH_PREFIX =
  /\b\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Regex matching a bare UUID (no prefix). Used only for exclusion, not extraction. */
export const MATCH_ID_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** URLs that signal a match has been found. */
export const MATCH_URL_PATTERNS = [
  "*://www.faceit.com/api/match/v4/match/*",
  "*://www.faceit.com/api/match/v1/checkin/*",
];

/**
 * Extract a FACEIT matchId from arbitrary text.
 * Only the PREFIXED form (e.g. "1-xxxxxxxx-...") is accepted.
 * Returns null if no valid matchId is found.
 */
export function extractMatchId(text: string): string | null {
  if (!text) return null;
  const match = text.match(MATCH_ID_WITH_PREFIX);
  return match ? match[0] : null;
}
