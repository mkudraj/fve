/**
 * Team section component - renders one faction's roster.
 */

import React from "react";
import type { FaceitPlayer } from "@fve/core";
import { PlayerRow } from "./PlayerRow.js";

interface TeamSectionProps {
  name: string;
  players: FaceitPlayer[];
  expandedPlayer: string | null;
  onToggleExpand: (playerId: string | null) => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({
  name,
  players,
  expandedPlayer,
  onToggleExpand,
}) => (
  <div style={{ marginBottom: 10 }}>
    <div
      style={{
        fontWeight: 600,
        fontSize: 12,
        color: "#e94560",
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {name}
    </div>
    {players.length === 0 && (
      <div style={{ fontSize: 11, color: "#666", padding: "4px 0" }}>
        No players loaded
      </div>
    )}
    {players.map((p) => (
      <PlayerRow
        key={p.playerId ?? p.nickname ?? Math.random().toString()}
        player={p}
        expanded={expandedPlayer === p.playerId}
        onToggle={() =>
          onToggleExpand(
            expandedPlayer === p.playerId ? null : p.playerId,
          )
        }
      />
    ))}
  </div>
);
