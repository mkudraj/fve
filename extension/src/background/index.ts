/**
 * Background service worker entry point.
 *
 * Responsibilities:
 *  1. Detect matchId from FACEIT network requests (webRequest).
 *  2. Fetch full roster from FACEIT Data API.
 *  3. Broadcast state changes to content script and popup.
 *  4. Serve popup state queries.
 */

import { isFullRoster } from "@fve/core";
import type { MatchScoutState } from "@fve/core";
import {
  getState,
  transitionToDetected,
  transitionToLoading,
  transitionToReady,
  transitionToPartial,
  transitionToError,
  resetToIdle,
} from "./state.js";
import { startMatchDetection, resetDetection } from "./match-detector.js";
import { loadMatchRoster, LoadError } from "./match-loader.js";
import type {
  StateChangedMessage,
  PopupStateMessage,
  PopupGetStateMessage,
  PopupClearMatchMessage,
} from "../shared/messages.js";
import type { ScoutOptions } from "../shared/types.js";

const DEFAULT_OPTIONS: ScoutOptions = {
  faceitApiKey: "",
  enableOverlay: true,
  showSteamName: true,
  showFaceitLevel: true,
  showMembership: true,
  showTechnicalIds: false,
};

async function getOptions(): Promise<ScoutOptions> {
  const stored = await chrome.storage.local.get("scoutOptions");
  return stored.scoutOptions
    ? { ...DEFAULT_OPTIONS, ...stored.scoutOptions }
    : DEFAULT_OPTIONS;
}

/** Broadcast current state to the active FACEIT tab. */
async function broadcastState(state: MatchScoutState): Promise<void> {
  const message: StateChangedMessage = { type: "STATE_CHANGED", state };
  try {
    const tabs = await chrome.tabs.query({
      url: "https://www.faceit.com/*",
    });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Content script may not be loaded yet - that's fine.
        });
      }
    }
  } catch {
    // Ignore errors if no FACEIT tabs are open.
  }
}

/** Handle matchId detection. */
async function onMatchDetected(matchId: string): Promise<void> {
  const options = await getOptions();

  if (!options.enableOverlay) return;
  if (!options.faceitApiKey) {
    transitionToError("NO_API_KEY", "FACEIT API key not configured");
    await broadcastState(getState());
    return;
  }

  transitionToDetected(matchId);
  await broadcastState(getState());

  transitionToLoading();
  await broadcastState(getState());

  try {
    const result = await loadMatchRoster(matchId, options.faceitApiKey);

    if (isFullRoster(result.faction1, result.faction2)) {
      transitionToReady(
        result.faction1,
        result.faction2,
        result.matchStatus,
      );
    } else {
      transitionToPartial(
        result.faction1,
        result.faction2,
        `Incomplete roster: ${result.faction1.length}+${result.faction2.length} players`,
      );
    }
  } catch (err) {
    if (err instanceof LoadError) {
      transitionToError(err.code, err.message);
    } else {
      transitionToError("UNKNOWN", (err as Error).message);
    }
  }

  await broadcastState(getState());
}

/** Serve popup state queries. */
function handlePopupMessage(
  message: PopupGetStateMessage | PopupClearMatchMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: PopupStateMessage) => void,
): boolean {
  if (message.type === "POPUP_GET_STATE") {
    getOptions().then((options) => {
      sendResponse({
        type: "POPUP_STATE",
        state: getState(),
        apiKeyConfigured: !!options.faceitApiKey,
        overlayEnabled: options.enableOverlay,
        lastError:
          getState().status === "error" ? getState().message : null,
      });
    });
    return true; // async response
  }

  if (message.type === "POPUP_CLEAR_MATCH") {
    resetToIdle();
    resetDetection();
    broadcastState(getState());
    sendResponse({
      type: "POPUP_STATE",
      state: getState(),
      apiKeyConfigured: false,
      overlayEnabled: false,
      lastError: null,
    });
    // Re-fetch options for the response.
    getOptions().then((options) => {
      sendResponse({
        type: "POPUP_STATE",
        state: getState(),
        apiKeyConfigured: !!options.faceitApiKey,
        overlayEnabled: options.enableOverlay,
        lastError: null,
      });
    });
    return true;
  }

  return false;
}

// ---- Init ----

startMatchDetection(onMatchDetected);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const msg = message as { type: string };
  if (msg.type === "POPUP_GET_STATE" || msg.type === "POPUP_CLEAR_MATCH") {
    return handlePopupMessage(
      message as PopupGetStateMessage | PopupClearMatchMessage,
      sender,
      sendResponse,
    );
  }
  if (msg.type === "GET_STATE") {
    sendResponse({ type: "STATE_CHANGED", state: getState() });
    return false;
  }
  return false;
});
