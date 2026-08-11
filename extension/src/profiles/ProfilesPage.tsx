/**
 * Full profiles page — opened in a new tab via "Open all profiles" button.
 * Shows all 10 players with FACEIT stats, Aim Rating, and profile links.
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FaceitPlayer } from "@fve/core";

interface ProfilesData {
  matchId: string;
  matchStatus: string;
  faction1: FaceitPlayer[];
  faction2: FaceitPlayer[];
}

const ProfilesPage: React.FC = () => {
  const [data, setData] = useState<ProfilesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get("profilesData", (result) => {
      if (result.profilesData) {
        setData(result.profilesData);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Loading profiles...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#e94560" }}>
        No profile data available. Go back to FACEIT and click "Open all profiles" from the overlay.
      </div>
    );
  }

  const allPlayers = [...data.faction1, ...data.faction2];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>FACEIT Pre-Match Scout — Player Profiles</h1>

      <div style={styles.meta}>
        <span>Match: {data.matchId}</span>
        <span>Status: {data.matchStatus}</span>
        <span>Players: {allPlayers.length}</span>
      </div>

      {[
        { name: "TEAM 1", players: data.faction1 },
        { name: "TEAM 2", players: data.faction2 },
      ].map((team) => (
        <div key={team.name} style={styles.teamSection}>
          <h2 style={styles.teamName}>{team.name}</h2>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={styles.colPlayer}>Player</span>
              <span style={styles.colStat}>Lvl</span>
              <span style={styles.colStat}>Aim</span>
              <span style={styles.colStat}>Win%</span>
              <span style={styles.colStat}>Rating</span>
              <span style={styles.colStat}>Swing</span>
              <span style={styles.colStat}>K/D/A</span>
              <span style={styles.colStat}>K/D</span>
              <span style={styles.colStat}>K/R</span>
              <span style={styles.colStat}>ADR</span>
              <span style={styles.colStat}>24h</span>
              <span style={styles.colLink}>Profiles</span>
            </div>
            {team.players.map((p) => {
              const ms = p.matchStats?.status === "available" ? p.matchStats.stats : null;
              const aimVal = p.aim?.status === "available" ? p.aim.value : null;
              const aimLabel =
                p.aim?.status === "available" ? aimVal :
                p.aim?.status === "loading" ? "…" :
                p.aim?.status === "unavailable" ? "N/A" :
                p.aim?.status === "error" ? "Err" : "—";

              return (
                <div key={p.playerId ?? p.nickname} style={styles.tableRow}>
                  <span style={styles.colPlayer}>
                    <strong>{p.nickname ?? "?"}</strong>
                    {p.steamName && p.steamName !== p.nickname && (
                      <span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>
                        ({p.steamName})
                      </span>
                    )}
                    {p.membership && (
                      <span style={styles.badge}>{p.membership}</span>
                    )}
                  </span>
                  <span style={styles.colStat}>{p.level ?? "?"}</span>
                  <span style={{...styles.colStat, color: aimVal != null ? "#4caf50" : p.aim?.status === "loading" ? "#666" : "#888"}}>
                    {aimLabel}
                  </span>
                  <span style={styles.colStat}>{ms?.winRate != null ? `${(ms.winRate * 100).toFixed(0)}%` : "—"}</span>
                  <span style={styles.colStat}>{ms?.avgRating != null ? ms.avgRating.toFixed(2) : "—"}</span>
                  <span style={{...styles.colStat, color: ms?.ratingSwing != null ? (ms.ratingSwing >= 0 ? "#4caf50" : "#e94560") : "#888"}}>
                    {ms?.ratingSwing != null ? `${ms.ratingSwing >= 0 ? "+" : ""}${ms.ratingSwing.toFixed(2)}` : "—"}
                  </span>
                  <span style={styles.colStat}>{ms?.kills != null ? `${ms.kills}/${ms.deaths}/${ms.assists}` : "—"}</span>
                  <span style={styles.colStat}>{ms?.kdRatio != null ? ms.kdRatio.toFixed(2) : "—"}</span>
                  <span style={styles.colStat}>{ms?.killsPerRound != null ? ms.killsPerRound.toFixed(2) : "—"}</span>
                  <span style={styles.colStat}>{ms?.adr != null ? ms.adr.toFixed(1) : "—"}</span>
                  <span style={styles.colStat}>
                    {ms?.last24h ? (
                      <span style={{ color: ms.last24h.label === "inconsistent" ? "#f0a500" : "#4caf50", fontSize: 10 }}>
                        {ms.last24h.label === "inconsistent" ? "⚠" : "✓"} {ms.last24h.games}g
                      </span>
                    ) : "—"}
                  </span>
                  <span style={styles.colLink}>
                    {p.steamId64 && (
                      <a
                        href={`https://steamcommunity.com/profiles/${p.steamId64}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.link}
                      >
                        Steam
                      </a>
                    )}
                    {p.steamId64 && (
                      <a
                        href={
                          p.aim?.status === "available" && p.aim.profileUrl
                            ? p.aim.profileUrl
                            : `https://leetify.com/app/profile/${p.steamId64}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...styles.link, marginLeft: 8 }}
                      >
                        Leetify
                      </a>
                    )}
                    {p.nickname && (
                      <a
                        href={`https://www.faceit.com/en/players/${encodeURIComponent(p.nickname)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...styles.link, marginLeft: 8 }}
                      >
                        FACEIT
                      </a>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={styles.footer}>
        Data from FACEIT Data API &amp; Leetify Public CS API
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "#1a1a2e",
    color: "#e0e0e0",
    minHeight: "100vh",
    padding: "24px 32px",
  },
  title: {
    fontSize: 20,
    color: "#e94560",
    marginBottom: 12,
  },
  meta: {
    display: "flex",
    gap: 24,
    fontSize: 12,
    color: "#888",
    marginBottom: 24,
  },
  teamSection: {
    marginBottom: 32,
  },
  teamName: {
    fontSize: 14,
    color: "#e94560",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 8,
  },
  table: {
    background: "#16213e",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    padding: "8px 12px",
    background: "#0f3460",
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "flex",
    padding: "10px 12px",
    borderBottom: "1px solid #2a2a4a",
    fontSize: 13,
    alignItems: "center",
  },
  colPlayer: {
    flex: 3,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  colStat: {
    flex: 1,
    textAlign: "center",
  },
  colLink: {
    flex: 2,
    textAlign: "center",
  },
  badge: {
    fontSize: 10,
    background: "#e94560",
    color: "#fff",
    padding: "1px 6px",
    borderRadius: 8,
    marginLeft: 4,
  },
  link: {
    color: "#5aa9e6",
    textDecoration: "none",
    fontSize: 12,
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: "1px solid #2a2a4a",
    fontSize: 11,
    color: "#555",
    textAlign: "center",
  },
};

// Mount
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(React.createElement(ProfilesPage));
}
