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

  const handlePreview = async () => {
    const mockState: MatchScoutState = {
      status: "ready",
      matchId: "1-ed06863c-ee54-4fe1-9278-475d72991017",
      detectedAt: Date.now() - 500,
      loadedAt: Date.now(),
      matchStatus: "CHECK_IN",
      faction1: [
        { nickname: "GR1NA", playerId: "p1", steamId64: "76561198249664530", steamName: "Gringo", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 81 }, matchStats: { status: "available", stats: { matchesAnalyzed: 30, totalMatches: 4314, winRate: 0.57, kdRatio: 1.12, killsPerRound: 0.78, adr: 83.7, kills: 702, deaths: 627, assists: 198, leetifyProfileUrl: "https://leetify.com/app/profile/steam/76561198249664530" } } },
        { nickname: "siNCo-", playerId: "p2", steamId64: "76561198119694078", steamName: "siNCo", level: 10, membership: "free", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 74 } },
        { nickname: "-AthE", playerId: "p3", steamId64: "76561198838634986", steamName: "AthE", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "unavailable", reason: "private" } },
        { nickname: "-T0KI", playerId: "p4", steamId64: "76561198838474668", steamName: "T0KI", level: 10, membership: "free", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 68 } },
        { nickname: "Ceo---", playerId: "p5", steamId64: "76561198362845213", steamName: "Ceo", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "loading" } },
      ],
      faction2: [
        { nickname: "108-", playerId: "p6", steamId64: "76561198782132866", steamName: "108", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 55 } },
        { nickname: "shorstky", playerId: "p7", steamId64: "76561198070756713", steamName: "shorstky", level: 10, membership: "premium", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 90 } },
        { nickname: "tumi", playerId: "p8", steamId64: "76561198035293177", steamName: "tumi", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "unavailable", reason: "not-registered" } },
        { nickname: "shadyb", playerId: "p9", steamId64: "76561198080436813", steamName: "shadyb", level: 10, membership: "premium", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 63 } },
        { nickname: "AHLIN-", playerId: "p10", steamId64: "76561198108255427", steamName: "AHLIN", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "error", message: "Network timeout" } },
      ],
      aimTiming: {
        requestsStartedAt: Date.now() - 500,
        firstAimLoadedAt: Date.now() - 200,
        allAimRequestsFinishedAt: Date.now(),
        availableAimCount: 6,
        unavailableAimCount: 2,
        errorAimCount: 1,
      },
    };

    const tabs = await chrome.tabs.query({ url: "https://www.faceit.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "STATE_CHANGED", state: mockState }).catch(() => {});
      }
    }
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
