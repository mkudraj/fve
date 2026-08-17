/**
 * Scout roster rendered inside the FACEIT accept modal (below Accept).
 * Thin card wrapper around the shared compact RosterTable.
 */

import React from "react";
import type { MatchScoutState } from "@fve/core";
import { RosterTable } from "./RosterTable.js";

interface Props {
  state: Extract<MatchScoutState, { status: "ready" | "partial" }>;
  accent1?: string;
  accent2?: string;
  /** Optional close handler - hides the in-modal view back to the badge. */
  onClose?: () => void;
}

/** Save roster data to storage and open the full profiles page. */
function openProfilesPage(state: Extract<MatchScoutState, { status: "ready" | "partial" }>): void {
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

export const ScoutOverview: React.FC<Props> = ({ state, accent1, accent2, onClose }) => {
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>Pre-Match Scout</span>
        <div style={s.headerActions}>
          {onClose && (
            <button type="button" style={s.closeBtn} onClick={onClose} title="Close scout view">
              ×
            </button>
          )}
          <button type="button" style={s.profilesBtn} onClick={() => openProfilesPage(state)}>
            Open all profiles
          </button>
        </div>
      </div>
      <RosterTable state={state} accent1={accent1} accent2={accent2} />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrap: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#e0e0e0",
    background: "#15151b",
    border: "1px solid #2a2a34",
    borderRadius: 10,
    padding: "10px 12px",
    marginTop: 12,
    maxHeight: "54vh",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8a8a93",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  profilesBtn: {
    background: "#26262e",
    color: "#a7a7c1",
    border: "1px solid #33333d",
    padding: "3px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 10,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  closeBtn: {
    background: "transparent",
    color: "#a7a7c1",
    border: "1px solid #33333d",
    padding: "1px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1.2,
  },
};
