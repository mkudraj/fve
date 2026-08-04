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
      <span style={{ fontWeight: 500, display: "flex", alignItems: "center" }}>
        {player.nickname ?? "?"}
        {player.steamName && player.steamName !== player.nickname && (
          <span style={{ color: "#888", marginLeft: 6, fontSize: 11 }}>
            ({player.steamName})
          </span>
        )}
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
        {player.anticheatRequired && (
          <div style={{ color: "#4caf50" }}>AC required</div>
        )}
      </div>
    )}
  </div>
);
