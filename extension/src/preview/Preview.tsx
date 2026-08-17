/**
 * Standalone "Preview overlay" page.
 *
 * Replicates FACEIT's MatchCheckInModal - the popup shown when a match is found
 * during matchmaking ("Match ready" + countdown + roster + Accept button) - and
 * docks the real scout overlay panel below the Accept button, exactly like on
 * the live accept screen. No FACEIT login needed.
 */

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FaceitPlayer, MatchScoutState } from "@fve/core";
import { Overlay } from "../content/Overlay.js";
import { computeInitialPosition, type OverlayPosition } from "../content/positioning.js";
import { buildMockState } from "../shared/mock.js";

const TOTAL_TIME = 25; // seconds shown on the countdown

const AVATAR_COLORS = ["#ff2248", "#2d7ff9", "#29c08e", "#f0a500", "#a855f7", "#26d1c6", "#e06417", "#ff4040", "#5747e6", "#44dd81"];

function initials(name: string): string {
  const clean = (name || "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  return (clean || "?").toUpperCase();
}

const Preview: React.FC = () => {
  const [state, setState] = useState<MatchScoutState>(() => buildMockState());
  const [pos, setPos] = useState<OverlayPosition>({ x: 20, y: 100 });
  const [userDragged, setUserDragged] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_TIME);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  // Live countdown like the real modal.
  useEffect(() => {
    if (hasCheckedIn || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, hasCheckedIn]);

  // Dock the panel below the mock Accept button (same logic as the content script).
  useEffect(() => {
    if (userDragged) return;
    const next = computeInitialPosition();
    if (next) setPos(next);
  }, [userDragged, state, hasCheckedIn]);

  const handlePositionChange = (p: OverlayPosition) => {
    setUserDragged(true);
    setPos(p);
  };

  const handleReset = () => {
    setUserDragged(false);
    setPos(computeInitialPosition() ?? { x: 20, y: 100 });
  };

  const handleAccept = () => {
    setHasCheckedIn(true);
  };

  const handleShowOverlay = () => {
    setState(buildMockState());
    setHasCheckedIn(false);
    setSecondsLeft(TOTAL_TIME);
    setUserDragged(false);
    setPos(computeInitialPosition() ?? { x: 20, y: 100 });
  };

  // Roster for the modal: party members first, then the rest; checked-in = full opacity.
  const roster = useMemo(() => {
    const all: FaceitPlayer[] = [...state.faction1, ...state.faction2].filter(Boolean);
    const party = all.slice(0, 2); // pretend first 2 are the party
    const others = all.slice(2);
    return [
      ...party.map((p, i) => ({ ...p, isParty: true, color: AVATAR_COLORS[i % AVATAR_COLORS.length] })),
      ...others.map((p, i) => ({ ...p, isParty: false, color: AVATAR_COLORS[(i + 2) % AVATAR_COLORS.length] })),
    ];
  }, [state]);

  const checkedInCount = hasCheckedIn ? roster.length : 0;
  const waiting = !hasCheckedIn && secondsLeft > 0;
  const expired = !hasCheckedIn && secondsLeft <= 0;
  const progress = (secondsLeft / TOTAL_TIME) * 100;

  return (
    <div style={styles.page}>
      {/* Mock FACEIT matchmaking backdrop */}
      <div style={styles.topbar}>
        <div style={styles.logo}>FACEIT</div>
        <div style={styles.topbarRight}>Matchmaking</div>
      </div>
      <div style={styles.backdropHint}>Searching for a match...</div>

      {/* ---- Replica of FACEIT MatchCheckInModal ---- */}
      <div style={styles.modalWrap}>
        <div style={styles.modal}>
          {/* countdown progress bar */}
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>

          {/* header */}
          <div style={styles.header}>
            <div style={styles.title}>{hasCheckedIn ? "We are preparing your match..." : "Match ready"}</div>
            <div style={styles.subtitle}>Matchmaking · EU · Party of 2</div>
          </div>

          {/* content */}
          <div style={styles.content}>
            {waiting && (
              <>
                <div style={styles.label}>Time left to accept</div>
                <div style={styles.countdown}>
                  00:{String(secondsLeft).padStart(2, "0")}
                </div>
                <div style={styles.status}>Waiting for other players...</div>
              </>
            )}

            {hasCheckedIn && (
              <>
                <div style={styles.label}>Matchmaking · EU · Party of 2</div>
                <div style={styles.checkedInRow}>
                  <span style={styles.checkedInCount}>{checkedInCount}/{roster.length}</span>
                  <span style={styles.checkedInText}>checked in</span>
                </div>
              </>
            )}

            {expired && (
              <>
                <div style={styles.label}>Check-in time has expired</div>
                <div style={styles.status}>The match is being cancelled</div>
              </>
            )}

            {/* roster avatars */}
            <div style={styles.roster}>
              {roster.map((p) => (
                <div key={p.playerId ?? p.nickname} style={styles.avatarWrap}>
                  <div
                    style={{
                      ...styles.avatar,
                      background: p.color,
                      opacity: p.isParty || hasCheckedIn ? 1 : 0.45,
                    }}
                    title={p.nickname ?? ""}
                  >
                    {initials(p.nickname ?? "")}
                  </div>
                  {p.isParty && <div style={styles.hostDot} title="Party leader" />}
                </div>
              ))}
            </div>
          </div>

          {/* footer */}
          {waiting && (
            <div style={styles.footer}>
              <button type="button" id="mock-accept-btn" style={styles.acceptBtn} onClick={handleAccept}>
                Accept
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Real scout overlay, docked below the mock Accept button ---- */}
      <Overlay
        state={state}
        position={pos}
        onPositionChange={handlePositionChange}
        onDismiss={() => setState({ status: "idle" })}
      />

      {/* ---- Controls ---- */}
      <div style={styles.controls}>
        <button type="button" onClick={handleShowOverlay}>
          Show overlay
        </button>
        <button type="button" onClick={handleReset}>
          Re-dock below Accept
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0e",
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: 52,
    padding: "0 20px",
    background: "#101015",
    borderBottom: "1px solid #1f1f26",
  },
  logo: {
    fontWeight: 800,
    color: "#ff4b4b",
    letterSpacing: "1px",
  },
  topbarRight: {
    fontSize: 12,
    color: "#666",
  },
  backdropHint: {
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 14,
    color: "#3a3a44",
  },
  modalWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "8vh",
  },
  modal: {
    width: 480,
    background: "#15151b",
    border: "1px solid #26262e",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  },
  progressTrack: {
    height: 3,
    background: "#26262e",
  },
  progressFill: {
    height: "100%",
    background: "#ff4b4b",
    transition: "width 1s linear",
  },
  header: {
    padding: "24px 24px 8px",
    textAlign: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#8a8a93",
  },
  content: {
    padding: "16px 24px 20px",
    textAlign: "center",
  },
  label: {
    fontSize: 12,
    color: "#8a8a93",
  },
  countdown: {
    marginTop: 6,
    fontSize: 44,
    fontWeight: 800,
    color: "#ffffff",
    fontVariantNumeric: "tabular-nums",
  },
  status: {
    marginTop: 10,
    fontSize: 13,
    color: "#8a8a93",
  },
  checkedInRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  checkedInCount: {
    fontSize: 28,
    fontWeight: 700,
    color: "#ffffff",
  },
  checkedInText: {
    fontSize: 13,
    color: "#8a8a93",
  },
  roster: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
  },
  hostDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#ff4b4b",
    border: "2px solid #15151b",
  },
  footer: {
    padding: "0 24px 24px",
  },
  acceptBtn: {
    display: "block",
    width: "100%",
    padding: "13px 0",
    fontSize: 16,
    fontWeight: 700,
    border: "none",
    borderRadius: 8,
    background: "#ff4b4b",
    color: "#fff",
    cursor: "pointer",
  },
  controls: {
    position: "fixed",
    right: 16,
    bottom: 16,
    display: "flex",
    gap: 8,
    zIndex: 2147483646,
  },
};

// Mount
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(React.createElement(Preview));
}
