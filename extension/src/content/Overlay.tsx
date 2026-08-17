/**
 * Floating overlay (fallback when the accept modal isn't present, e.g. on the
 * matchroom page). Draggable, collapsible panel showing the compact RosterTable.
 */

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type { MatchScoutState } from "@fve/core";
import { RosterTable } from "./RosterTable.js";
import type { OverlayPosition } from "./positioning.js";

interface OverlayProps {
  state: MatchScoutState;
  onDismiss: () => void;
  /** Controlled panel position (content script keeps it docked under Accept). */
  position: OverlayPosition;
  onPositionChange: (position: OverlayPosition) => void;
}

export const Overlay: React.FC<OverlayProps> = ({
  state,
  onDismiss,
  position,
  onPositionChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // Local position so dragging stays smooth; the content script re-anchors
  // the panel below the check-in button until the user grabs it.
  const [pos, setPos] = useState<{ x: number; y: number }>(position);
  const [panelHeight, setPanelHeight] = useState(0);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Follow the docked position pushed from the content script (unless dragging).
  useEffect(() => {
    if (!dragging.current) setPos(position);
  }, [position]);

  // Measure the real panel height so we can keep it fully on screen.
  useLayoutEffect(() => {
    if (panelRef.current) setPanelHeight(panelRef.current.offsetHeight);
  }, [state, collapsed]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      // Mark the position as user-controlled so the content script stops docking.
      onPositionChange({ x: pos.x, y: pos.y });
      e.preventDefault();
    },
    [pos, onPositionChange],
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

  // Keep the panel fully on screen once its real height is known.
  const height = panelHeight > 0 ? panelHeight : 480;
  const maxTop = Math.max(8, window.innerHeight - height - 8);
  const top = Math.min(Math.max(8, pos.y), maxTop);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(Math.max(8, pos.x), Math.max(8, window.innerWidth - 460 - 8)),
    top,
    zIndex: 2147483647,
    // Never let the panel extend past the viewport - scroll internally if needed.
    maxHeight: "calc(100vh - 16px)",
    overflowY: "auto",
    width: collapsed ? "auto" : 460,
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
          {renderContent(state)}
        </div>
      )}
    </div>
  );
};

function renderContent(state: MatchScoutState): React.ReactNode {
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
    case "partial":
      return (
        <div>
          <RosterTable state={state} />
          {state.status === "partial" && (
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
          )}
          {state.status === "ready" && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #2a2a4a",
                fontSize: 10,
                color: "#555",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Match: {state.matchStatus} · Data by Leetify</span>
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
          )}
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
function openProfilesPage(state: Extract<MatchScoutState, { status: "ready" | "partial" }>) {
  const data = {
    matchId: state.matchId,
    matchStatus: state.status === "ready" ? state.matchStatus : "PARTIAL",
    faction1: state.faction1,
    faction2: state.faction2,
  };
  chrome.storage.local.set({ profilesData: data }, () => {
    chrome.runtime.sendMessage({ type: "OPEN_PROFILES_PAGE" });
  });
}
