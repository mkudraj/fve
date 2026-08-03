/**
 * Recursively search network event data for match-related identifiers.
 * Case-insensitive, handles nested JSON, arrays, and JSON-in-strings.
 */
import type { NetworkEvent, MatchHit } from "../types/index.js";

// Terms to search for in URLs, JSON keys, and values
const SEARCH_TERMS = [
  "match_id", "matchid",
  "matchroom", "room",
  "roster",
  "faction1", "faction2", "faction",
  "team1", "team2", "team",
  "players",
  "player_id", "playerid",
  "nickname", "nick",
  "map",
  "server",
  "connect",
  "ready", "ready_check",
  "matchmaking", "queue",
  "configured", "configuring", "created",
  "status",
];

// Patterns to extract match IDs (e.g., UUID-like)
const MATCH_ID_PATTERN = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i;
const MATCH_ID_SHORT = /\b[0-9a-f]{24,}\b/i;

export function extractHits(event: NetworkEvent): MatchHit[] {
  const hits: MatchHit[] = [];

  // Search URL for match-related terms
  const urlLower = event.url.toLowerCase();
  for (const term of SEARCH_TERMS) {
    if (urlLower.includes(term)) {
      hits.push({
        timestamp: event.timestamp,
        source: `${event.source}`,
        url: event.url,
        path: "url",
        value: event.url,
        phase: "unknown",
      });
      break; // one hit per URL is enough
    }
  }

  // Search response body (JSON)
  if (event.responseBody) {
    hits.push(...searchInJson(event.responseBody, event, "responseBody"));
  }

  // Search WebSocket frames
  if (event.wsFrameData) {
    hits.push(...searchInJson(event.wsFrameData, event, "wsFrame"));
  }

  // Extract specific match ID values from any field
  const allText = [event.url, event.responseBody, event.wsFrameData]
    .filter(Boolean)
    .join(" ");
  const matchIdMatches =
    allText.match(MATCH_ID_PATTERN) || allText.match(MATCH_ID_SHORT);
  if (matchIdMatches) {
    hits.push({
      timestamp: event.timestamp,
      source: `${event.source}`,
      url: event.url,
      path: "extracted",
      value: matchIdMatches[0],
      phase: "unknown",
    });
  }

  return hits;
}

function searchInJson(
  raw: string,
  event: NetworkEvent,
  source: string,
): MatchHit[] {
  const hits: MatchHit[] = [];

  // Try to parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Maybe JSON embedded in a string - try simple key:value matching
    for (const term of SEARCH_TERMS) {
      const lower = raw.toLowerCase();
      if (lower.includes(term)) {
        hits.push({
          timestamp: event.timestamp,
          source: `${event.source}/${source}`,
          url: event.url,
          path: term,
          value: `[found in raw text, ${raw.length} bytes]`,
          phase: "unknown",
        });
      }
    }
    return hits;
  }

  // Recursively search the parsed JSON
  searchObject(parsed, "", source, event, hits, 0);
  return hits;
}

function searchObject(
  obj: unknown,
  path: string,
  source: string,
  event: NetworkEvent,
  hits: MatchHit[],
  depth: number,
): void {
  if (depth > 20) return; // safety limit
  if (obj === null || obj === undefined) return;

  if (typeof obj === "string") {
    // Check if this string value matches any search term
    for (const term of SEARCH_TERMS) {
      if (obj.toLowerCase().includes(term)) {
        hits.push({
          timestamp: event.timestamp,
          source: `${event.source}/${source}`,
          url: event.url,
          path: path || "(root)",
          value: obj.length > 200 ? obj.substring(0, 200) + "..." : obj,
          phase: "unknown",
        });
        break;
      }
    }

    // Try parsing embedded JSON
    try {
      const nested = JSON.parse(obj);
      if (typeof nested === "object" && nested !== null) {
        searchObject(nested, path, source, event, hits, depth + 1);
      }
    } catch {
      // Not JSON, ignore
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length && i < 100; i++) {
      searchObject(obj[i], `${path}[${i}]`, source, event, hits, depth + 1);
    }
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      const newPath = path ? `${path}.${key}` : key;

      // Check if the key matches a search term
      for (const term of SEARCH_TERMS) {
        if (keyLower.includes(term)) {
          const valStr =
            typeof value === "string"
              ? value
              : JSON.stringify(value).substring(0, 200);
          hits.push({
            timestamp: event.timestamp,
            source: `${event.source}/${source}`,
            url: event.url,
            path: newPath,
            value: valStr,
            phase: "unknown",
          });
          break;
        }
      }

      // Recurse into the value
      searchObject(value, newPath, source, event, hits, depth + 1);
    }
  }
}

export function getMatchIds(hits: MatchHit[]): string[] {
  const ids = new Set<string>();
  for (const hit of hits) {
    const m = hit.value.match(MATCH_ID_PATTERN);
    if (m) ids.add(m[0]);
  }
  return [...ids];
}
