/**
 * Message types for background <-> content script communication.
 */

import type { MatchScoutState } from "@fve/core";

// ---- Background -> Content ----

export interface StateChangedMessage {
  type: "STATE_CHANGED";
  state: MatchScoutState;
}

// ---- Content -> Background ----

export interface GetStateMessage {
  type: "GET_STATE";
}

// ---- Popup -> Background ----

export interface PopupGetStateMessage {
  type: "POPUP_GET_STATE";
}

export interface PopupClearMatchMessage {
  type: "POPUP_CLEAR_MATCH";
}

// ---- Background -> Popup ----

export interface PopupStateMessage {
  type: "POPUP_STATE";
  state: MatchScoutState;
  apiKeyConfigured: boolean;
  overlayEnabled: boolean;
  lastError: string | null;
}

// ---- Union types ----

export type BgToContentMessage = StateChangedMessage;
export type ContentToBgMessage = GetStateMessage;
export type PopupToBgMessage = PopupGetStateMessage | PopupClearMatchMessage;
export type BgToPopupMessage = PopupStateMessage;
