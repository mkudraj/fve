/**
 * Match ID detection via chrome.webRequest.
 *
 * Listens for requests to FACEIT match/checkin endpoints and extracts
 * the prefixed matchId from the URL.
 */

import { extractMatchId } from "@fve/core";

const MATCH_URL_FILTERS = [
  "*://www.faceit.com/api/match/v4/match/*",
  "*://www.faceit.com/api/match/v1/checkin/*",
];

let currentMatchId: string | null = null;

/** Start listening for match requests. */
export function startMatchDetection(
  onDetected: (matchId: string) => void,
): void {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const matchId = extractMatchId(details.url);
      if (!matchId) return;

      // Deduplicate: only trigger once per matchId.
      if (matchId === currentMatchId) return;
      currentMatchId = matchId;

      onDetected(matchId);
    },
    { urls: MATCH_URL_FILTERS },
  );
}

/** Reset the seen matchId (e.g. when user clears match). */
export function resetDetection(): void {
  currentMatchId = null;
}
