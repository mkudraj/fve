/**
 * Main overlay component.
 *
 * Displays both teams' rosters in a draggable, collapsible panel
 * positioned over the FACEIT ready-check modal.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { MatchScoutState } from "@fve/core";
import { TeamSection } from "./TeamSection.js";

interface OverlayProps {
  state: MatchScoutState;
  onDismiss: () => void;
}

export const Overlay: React.FC<OverlayProps> = ({ state, onDismiss }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 20, y: 100 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      e.preventDefault();
    },
    [pos],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (state.status === "idle") return null;

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 2147483647,
    width: collapsed ? "auto" : 320,
    background: "rgba(22, 33, 62, 0.97)",
    border: "1px solid #e94560",
    borderRadius: 8,
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    boxShadow: "0 4px 24px rgba(233, 69, 96, 0.3)",
    userSelect: "none",
    pointerEvents: "auto",
  };

  return (
    <div ref={panelRef} style={panelStyle}>
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #2a2a4a",
          cursor: "move",
          background: "#e94560",
          borderRadius: "7px 7px 0 0",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <span>FACEIT Pre-Match Scout</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {collapsed ? "+" : "−"}
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "8px 12px" }}>
          {renderContent(state, expandedPlayer, setExpandedPlayer)}
        </div>
      )}
    </div>
  );
};

function renderContent(
  state: MatchScoutState,
  expandedPlayer: string | null,
  setExpandedPlayer: (id: string | null) => void,
): React.ReactNode {
  switch (state.status) {
    case "match-detected":
      return (
        <div style={{ padding: "12px 0", textAlign: "center" }}>
          <div style={{ color: "#e94560", fontWeight: 600 }}>
            Match found!
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            {state.matchId}
          </div>
        </div>
      );

    case "loading":
      return (
        <div style={{ padding: "12px 0", textAlign: "center" }}>
          <div style={{ color: "#e94560" }}>Loading roster...</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            {state.matchId}
          </div>
        </div>
      );

    case "ready":
      return (
        <div>
          <TeamSection
            name="TEAM 1"
            players={state.faction1}
            expandedPlayer={expandedPlayer}
            onToggleExpand={setExpandedPlayer}
          />
          <TeamSection
            name="TEAM 2"
            players={state.faction2}
            expandedPlayer={expandedPlayer}
            onToggleExpand={setExpandedPlayer}
          />
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #2a2a4a",
              fontSize: 11,
              color: "#888",
            }}
          >
            <div>Match status: {state.matchStatus}</div>
            <div>Match ID: {state.matchId}</div>
            <div>Roster loaded in: {state.loadedAt - state.detectedAt} ms</div>
            {state.aimTiming && state.aimTiming.firstAimLoadedAt != null && (
              <>
                <div>
                  First Aim loaded:{" "}
                  {state.aimTiming.firstAimLoadedAt - state.aimTiming.requestsStartedAt} ms
                </div>
                <div>
                  Aim available: {state.aimTiming.availableAimCount}
                  /{state.aimTiming.availableAimCount + state.aimTiming.unavailableAimCount + state.aimTiming.errorAimCount}
                </div>
              </>
            )}
            <div
              style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: "1px solid #2a2a4a",
                fontSize: 10,
                color: "#555",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Data Provided by Leetify</span>
              <button
                onClick={() => openProfilesPage(state)}
                style={{
                  background: "#0f3460",
                  color: "#5aa9e6",
                  border: "1px solid #2a2a4a",
                  padding: "3px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                Open all profiles
              </button>
            </div>
          </div>
        </div>
      );

    case "partial":
      return (
        <div>
          <TeamSection
            name="TEAM 1"
            players={state.faction1}
            expandedPlayer={expandedPlayer}
            onToggleExpand={setExpandedPlayer}
          />
          <TeamSection
            name="TEAM 2"
            players={state.faction2}
            expandedPlayer={expandedPlayer}
            onToggleExpand={setExpandedPlayer}
          />
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #2a2a4a",
              fontSize: 11,
              color: "#e94560",
            }}
          >
            {state.message}
          </div>
        </div>
      );

    case "error":
      return (
        <div style={{ padding: "12px 0", textAlign: "center" }}>
          <div style={{ color: "#e94560", fontWeight: 600 }}>Error</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            [{state.code}] {state.message}
          </div>
        </div>
      );

    default:
      return null;
  }
}

/** Save roster data to storage and open the full profiles page in a new tab. */
function openProfilesPage(state: Extract<MatchScoutState, { status: "ready" }>) {
  const data = {
    matchId: state.matchId,
    matchStatus: state.matchStatus,
    faction1: state.faction1,
    faction2: state.faction2,
  };
  chrome.storage.local.set({ profilesData: data }, () => {
    chrome.runtime.sendMessage({ type: "OPEN_PROFILES_PAGE" });
  });
}
