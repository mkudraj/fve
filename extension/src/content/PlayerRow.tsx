/**
 * Player row component - displays a single player with expandable details.
 */

import React from "react";
import type { FaceitPlayer, AimRatingState } from "@fve/core";

interface PlayerRowProps {
  player: FaceitPlayer;
  expanded: boolean;
  onToggle: () => void;
}

function renderAim(aim: AimRatingState | undefined): React.ReactNode {
  if (!aim || aim.status === "idle") return null;

  const baseStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 8,
  };

  switch (aim.status) {
    case "loading":
      return <span style={{ ...baseStyle, color: "#666" }} title="Loading Leetify data...">Aim: …</span>;
    case "available":
      return (
        <span
          style={{ ...baseStyle, color: "#4caf50" }}
          title={`Leetify Aim Rating: ${aim.value}`}
        >
          Aim: {aim.value}
        </span>
      );
    case "unavailable":
      return (
        <span
          style={{ ...baseStyle, color: "#888" }}
          title="Leetify data unavailable"
        >
          Aim: N/A
        </span>
      );
    case "rate-limited":
      return (
        <span
          style={{ ...baseStyle, color: "#f0a500" }}
          title="Leetify rate limited"
        >
          Aim: …
        </span>
      );
    case "error":
      return (
        <span
          style={{ ...baseStyle, color: "#e94560" }}
          title="Failed to load Leetify profile"
        >
          Aim: Error
        </span>
      );
    default:
      return null;
  }
}

export const PlayerRow: React.FC<PlayerRowProps> = ({
  player,
  expanded,
  onToggle,
}) => (
  <div>
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 6px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 13,
        transition: "background 0.15s",
        background: expanded ? "rgba(233, 69, 96, 0.15)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!expanded)
          (e.currentTarget as HTMLElement).style.background =
            "rgba(233, 69, 96, 0.08)";
      }}
      onMouseLeave={(e) => {
        if (!expanded)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
        {player.nickname ?? "?"}
        {player.steamName && player.steamName !== player.nickname && (
          <span style={{ color: "#888", marginLeft: 6, fontSize: 11 }}>
            ({player.steamName})
          </span>
        )}
        {player.steamId64 && (
          <a
            href={`https://steamcommunity.com/profiles/${player.steamId64}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Steam profile"
            style={{
              color: "#5aa9e6",
              textDecoration: "none",
              fontSize: 10,
              marginLeft: 4,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            Steam
          </a>
        )}
        {(player.aim?.status === "available" && player.aim.profileUrl) || player.steamId64 ? (
          <a
            href={
              player.aim?.status === "available" && player.aim.profileUrl
                ? player.aim.profileUrl
                : `https://leetify.com/public/profile/${player.steamId64}`
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Leetify profile"
            style={{
              color: "#f0a500",
              textDecoration: "none",
              fontSize: 10,
              marginLeft: 2,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            Leetify
          </a>
        ) : null}
        {renderAim(player.aim)}
      </span>
      <span style={{ color: "#e94560", fontSize: 12, fontWeight: 600 }}>
        {player.level !== null ? `Level ${player.level}` : "?"}
      </span>
    </div>

    {expanded && (
      <div
        style={{
          marginLeft: 8,
          padding: "4px 8px 6px",
          borderLeft: "2px solid #e94560",
          fontSize: 11,
          color: "#888",
        }}
      >
        {player.membership && (
          <div>
            Membership: <span style={{ color: "#ccc" }}>{player.membership}</span>
          </div>
        )}
        {player.steamId64 && (
          <div>
            SteamID64: <span style={{ color: "#ccc" }}>{player.steamId64}</span>
          </div>
        )}
        {player.playerId && (
          <div>
            FACEIT ID: <span style={{ color: "#ccc" }}>{player.playerId}</span>
          </div>
        )}
        {player.matchStats?.status === "loading" && (
          <div style={{ color: "#666" }}>Match stats: loading...</div>
        )}
        {player.matchStats?.status === "available" && (
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #333" }}>
            <div style={{ color: "#888", marginBottom: 2 }}>
              Last {player.matchStats.stats.matchesAnalyzed} matches
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {player.matchStats.stats.winRate != null && (
                <span>
                  <span style={{ color: "#888" }}>Win </span>
                  <span style={{ color: "#ccc" }}>{(player.matchStats.stats.winRate * 100).toFixed(0)}%</span>
                </span>
              )}
              {player.matchStats.stats.avgRating != null && (
                <span>
                  <span style={{ color: "#888" }}>Rating </span>
                  <span style={{ color: "#ccc" }}>{player.matchStats.stats.avgRating.toFixed(2)}</span>
                </span>
              )}
              {player.matchStats.stats.ratingSwing != null && (
                <span>
                  <span style={{ color: "#888" }}>Swing </span>
                  <span style={{ color: player.matchStats.stats.ratingSwing >= 0 ? "#4caf50" : "#e94560" }}>
                    {player.matchStats.stats.ratingSwing >= 0 ? "+" : ""}{player.matchStats.stats.ratingSwing.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
            {player.matchStats.stats.kills != null && (
              <div style={{ marginTop: 2 }}>
                <span style={{ color: "#888" }}>K/D/A </span>
                <span style={{ color: "#ccc" }}>
                  {player.matchStats.stats.kills}/{player.matchStats.stats.deaths}/{player.matchStats.stats.assists}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              {player.matchStats.stats.kdRatio != null && (
                <span>
                  <span style={{ color: "#888" }}>K/D </span>
                  <span style={{ color: "#ccc" }}>{player.matchStats.stats.kdRatio.toFixed(2)}</span>
                </span>
              )}
              {player.matchStats.stats.killsPerRound != null && (
                <span>
                  <span style={{ color: "#888" }}>K/R </span>
                  <span style={{ color: "#ccc" }}>{player.matchStats.stats.killsPerRound.toFixed(2)}</span>
                </span>
              )}
              {player.matchStats.stats.adr != null && (
                <span>
                  <span style={{ color: "#888" }}>ADR </span>
                  <span style={{ color: "#ccc" }}>{player.matchStats.stats.adr.toFixed(1)}</span>
                </span>
              )}
            </div>
            {player.matchStats.stats.last24h && (
              <div style={{ marginTop: 3, fontSize: 10, color: "#f0a500" }}>
                {player.matchStats.stats.last24h.label === "inconsistent"
                  ? "⚠ "
                  : player.matchStats.stats.last24h.label === "consistent"
                    ? "✓ "
                    : ""}
                {player.matchStats.stats.last24h.detail}
              </div>
            )}
          </div>
        )}
        {player.anticheatRequired && (
          <div style={{ color: "#4caf50" }}>AC required</div>
        )}
      </div>
    )}
  </div>
);
