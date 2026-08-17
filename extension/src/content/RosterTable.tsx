/**
 * Compact roster table shared by the in-modal scout view and the floating
 * overlay. No avatars, one row per player, shared stat column header - so it
 * is compact and easy to read in both places.
 */

import React from "react";
import type { FaceitPlayer, MatchScoutState } from "@fve/core";

interface Props {
  state: Extract<MatchScoutState, { status: "ready" | "partial" }>;
  accent1?: string;
  accent2?: string;
}

function renderAim(player: FaceitPlayer): React.ReactNode {
  const aim = player.aim;
  if (!aim) return <span style={s.muted}>—</span>;
  switch (aim.status) {
    case "loading":
      return <span style={{ ...s.muted, color: "#8a8a93" }}>…</span>;
    case "available":
      return (
        <span style={{ ...s.value, color: aim.value >= 75 ? "#29c08e" : aim.value >= 55 ? "#f0a500" : "#ff4b4b" }}>
          {aim.value}
        </span>
      );
    case "unavailable":
      return <span style={s.muted}>N/A</span>;
    case "rate-limited":
      return <span style={s.muted}>…</span>;
    case "error":
      return <span style={{ ...s.muted, color: "#ff4b4b" }}>Err</span>;
    default:
      return <span style={s.muted}>—</span>;
  }
}

const PlayerRow: React.FC<{ player: FaceitPlayer }> = ({ player }) => {
  const ms = player.matchStats?.status === "available" ? player.matchStats.stats : null;

  return (
    <div style={s.row}>
      <div style={s.name} title={player.steamName ?? undefined}>
        <span style={s.nick}>{player.nickname ?? "?"}</span>
        {player.membership && (
          <span style={s.badge} title={player.membership}>
            {player.membership === "premium" ? "P" : "F"}
          </span>
        )}
      </div>
      <div style={s.cell(s.cLvl)} title="Level">{player.level ?? "?"}</div>
      <div style={s.cell(s.cAim)} title="Aim Rating (Leetify)">{renderAim(player)}</div>
      <div style={s.cell(s.cGames)} title="Overall matches (FACEIT)">
        {ms?.totalMatches != null ? ms.totalMatches : <span style={s.muted}>—</span>}
      </div>
      <div style={s.cell(s.cWin)} title="Win rate (last 20 matches)">
        {ms?.winRate != null ? `${(ms.winRate * 100).toFixed(0)}%` : <span style={s.muted}>—</span>}
      </div>
      <div style={s.cell(s.cAdrHs)} title="ADR / Headshot % (last 20 matches)">
        {ms?.adr != null || ms?.headshotRate != null ? (
          <>
            {ms.adr != null ? ms.adr.toFixed(1) : <span style={s.muted}>—</span>}
            <span style={s.muted}> / </span>
            {ms.headshotRate != null ? `${Math.round(ms.headshotRate)}%` : <span style={s.muted}>—</span>}
          </>
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div style={s.cell(s.cKdKr)} title="K/D / K/R (last 20 matches)">
        {ms?.kdRatio != null || ms?.killsPerRound != null ? (
          <>
            {ms.kdRatio != null ? ms.kdRatio.toFixed(2) : <span style={s.muted}>—</span>}
            <span style={s.muted}> / </span>
            {ms.killsPerRound != null ? ms.killsPerRound.toFixed(2) : <span style={s.muted}>—</span>}
          </>
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
    </div>
  );
};

export const RosterTable: React.FC<Props> = ({
  state,
  accent1 = "#26d1c6",
  accent2 = "#5747e6",
}) => {
  const teams = [
    { key: "team1", label: state.faction1[0]?.team ?? "TEAM 1", accent: accent1, players: state.faction1 },
    { key: "team2", label: state.faction2[0]?.team ?? "TEAM 2", accent: accent2, players: state.faction2 },
  ];

  return (
    <div>
      {/* shared stat column header */}
      <div style={s.headerRow}>
        <div style={s.name} />
        <div style={s.col(s.cLvl)}>Lvl</div>
        <div style={s.col(s.cAim)}>Aim</div>
        <div style={s.col(s.cGames)}>Games</div>
        <div style={s.col(s.cWin)}>Win</div>
        <div style={s.col(s.cAdrHs)}>ADR/HS</div>
        <div style={s.col(s.cKdKr)}>K/D/K/R</div>
      </div>

      {teams.map((team) => (
        <div key={team.key}>
          <div style={{ ...s.teamHeader, color: team.accent, borderColor: team.accent }}>{team.label}</div>
          {team.players.map((p) => (
            <PlayerRow key={p.playerId ?? p.nickname} player={p} />
          ))}
        </div>
      ))}
    </div>
  );
};

const s: Record<string, React.CSSProperties | ((w: React.CSSProperties) => React.CSSProperties)> = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    padding: "2px 8px",
    borderBottom: "1px solid #2a2a34",
    marginBottom: 2,
  },
  col: (w: React.CSSProperties) => ({
    ...w,
    fontSize: 9,
    color: "#757589",
    textTransform: "uppercase",
    textAlign: "center" as const,
  }),
  teamHeader: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "6px 8px 3px",
    borderBottom: "1px solid",
    margin: "4px 0 2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 5,
    fontSize: 12,
  },
  name: {
    flex: 1,
    minWidth: 90,
    display: "flex",
    alignItems: "center",
    gap: 5,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  nick: {
    fontWeight: 600,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  badge: {
    fontSize: 8,
    background: "#ff2248",
    color: "#fff",
    padding: "0 4px",
    borderRadius: 3,
    fontWeight: 700,
  },
  cell: (w: React.CSSProperties) => ({
    ...w,
    textAlign: "center" as const,
    fontVariantNumeric: "tabular-nums" as const,
    whiteSpace: "nowrap" as const,
  }),
  cLvl: { width: 26, flex: "0 0 26px" },
  cAim: { width: 36, flex: "0 0 36px" },
  cGames: { width: 42, flex: "0 0 42px" },
  cWin: { width: 40, flex: "0 0 40px" },
  cAdrHs: { width: 78, flex: "0 0 78px" },
  cKdKr: { width: 78, flex: "0 0 78px" },
  value: {
    fontWeight: 600,
    color: "#e0e0e0",
  },
  muted: {
    color: "#5a5a66",
  },
};
