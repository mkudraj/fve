/**
 * Popup page - shows extension status and current match info.
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MatchScoutState } from "@fve/core";
import type { PopupStateMessage } from "../shared/messages.js";

interface PopupData {
  state: MatchScoutState;
  apiKeyConfigured: boolean;
  leetifyKeyConfigured: boolean;
  overlayEnabled: boolean;
  aimRatingEnabled: boolean;
  lastError: string | null;
}

const Popup: React.FC = () => {
  const [data, setData] = useState<PopupData | null>(null);

  const refresh = () => {
    chrome.runtime.sendMessage({ type: "POPUP_GET_STATE" }, (response: PopupStateMessage) => {
      if (response) {
        setData({
          state: response.state,
          apiKeyConfigured: response.apiKeyConfigured,
          overlayEnabled: response.overlayEnabled,
          lastError: response.lastError,
        });
      }
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: "POPUP_CLEAR_MATCH" }, () => {
      refresh();
    });
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handlePreview = () => {
    // Open the 1:1 preview - the real FACEIT matchroom page with the scout
    // overlay docked below the check-in button (no FACEIT login needed).
    chrome.tabs.create({ url: chrome.runtime.getURL("faceit-match.html") });
  };

  if (!data) {
    return <div style={{ padding: 8, textAlign: "center", color: "#888" }}>Loading...</div>;
  }

  const { state, apiKeyConfigured, leetifyKeyConfigured, overlayEnabled, aimRatingEnabled, lastError } = data;

  const statusLabel =
    state.status === "idle"
      ? "Waiting for match..."
      : state.status === "match-detected"
        ? "Match detected"
        : state.status === "loading"
          ? "Loading roster..."
          : state.status === "ready"
            ? "Roster ready"
            : state.status === "partial"
              ? "Partial roster"
              : "Error";

  const playerCount =
    state.status === "ready"
      ? `${state.faction1.length + state.faction2.length}/10`
      : state.status === "partial"
        ? `${state.faction1.length + state.faction2.length}/10`
        : "—";

  return (
    <div>
      <h2>FACEIT Pre-Match Scout</h2>

      <div className="section">
        <div className="row">
          <span className="label">Extension</span>
          <span className="value" style={{ color: overlayEnabled ? "#4caf50" : "#e94560" }}>
            {overlayEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="row">
          <span className="label">API Key</span>
          <span className="value" style={{ color: apiKeyConfigured ? "#4caf50" : "#e94560" }}>
            {apiKeyConfigured ? "Configured" : "Missing"}
          </span>
        </div>
        <div className="row">
          <span className="label">Leetify Key</span>
          <span className="value" style={{ color: leetifyKeyConfigured ? "#4caf50" : "#e94560" }}>
            {leetifyKeyConfigured ? "Configured" : "Missing"}
          </span>
        </div>
        <div className="row">
          <span className="label">Status</span>
          <span className="value">{statusLabel}</span>
        </div>
        {(state.status === "ready" || state.status === "partial") && (
          <>
            <div className="row">
              <span className="label">Match ID</span>
              <span className="value" style={{ fontSize: 10 }}>
                {state.matchId}
              </span>
            </div>
            <div className="row">
              <span className="label">Players loaded</span>
              <span className="value">{playerCount}</span>
            </div>
            {state.status === "ready" && (
              <div className="row">
                <span className="label">Match status</span>
                <span className="value">{state.matchStatus}</span>
              </div>
            )}
          </>
        )}
        {state.status === "error" && (
          <div className="error">
            [{state.code}] {state.message}
          </div>
        )}
      </div>

      <div className="section">
        <button onClick={handleClear} style={{ marginRight: 8 }}>
          Clear overlay
        </button>
      </div>

      <div className="section">
        <button onClick={handleOpenOptions} className="secondary" style={{ marginRight: 8 }}>
          Open Options
        </button>
        <button onClick={handlePreview} className="secondary">
          Preview overlay
        </button>
      </div>
    </div>
  );
};

// Mount
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(React.createElement(Popup));
}
