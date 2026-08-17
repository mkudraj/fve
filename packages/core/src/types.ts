/** A single FACEIT player extracted from the Data API response. */
export interface FaceitPlayer {
  nickname: string | null;
  playerId: string | null;
  steamId64: string | null;
  steamName: string | null;
  level: number | null;
  membership: string | null;
  anticheatRequired: boolean;
  team: string | null;
  /** Aim Rating from Leetify (populated progressively after roster loads). */
  aim?: AimRatingState;
  /** Aggregated match stats from Leetify (last 30 matches). */
  matchStats?: MatchStatsState;
}

/**
 * Aggregated player match stats - sourced from FACEIT's own stats API
 * (same data the FACEIT roster widget shows: Overall Matches + Last 20 Matches).
 * Leetify is used ONLY for the Aim Rating.
 */
export interface MatchStats {
  /** Number of 5v5 matches analyzed (last 20 window). */
  matchesAnalyzed: number;
  /** Overall lifetime matches count. */
  totalMatches: number;
  /** Win rate over the analyzed matches (0..1). */
  winRate: number | null;
  /** Average K/D ratio. */
  kdRatio: number | null;
  /** Average K/R ratio. */
  killsPerRound: number | null;
  /** Average ADR (damage per round). */
  adr: number | null;
  /** Average Headshot %. */
  headshotRate: number | null;
}

export type MatchStatsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "available"; stats: MatchStats }
  | { status: "unavailable" };

/** Leetify Aim Rating state per player. */
export type AimRatingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "available"; value: number; profileUrl?: string }
  | {
      status: "unavailable";
      reason: "not-registered" | "private" | "not-found" | "missing-steam-id";
    }
  | { status: "rate-limited" }
  | { status: "error"; message: string };

/** Timing measurements for Leetify integration (dev mode). */
export interface AimTiming {
  requestsStartedAt: number;
  firstAimLoadedAt: number | null;
  allAimRequestsFinishedAt: number | null;
  availableAimCount: number;
  unavailableAimCount: number;
  errorAimCount: number;
}

/** The extension's state machine. */
export type MatchScoutState =
  | { status: "idle" }
  | {
      status: "match-detected";
      matchId: string;
      detectedAt: number;
    }
  | {
      status: "loading";
      matchId: string;
      detectedAt: number;
    }
  | {
      status: "ready";
      matchId: string;
      detectedAt: number;
      loadedAt: number;
      matchStatus: string;
      faction1: FaceitPlayer[];
      faction2: FaceitPlayer[];
      aimTiming?: AimTiming;
    }
  | {
      status: "partial";
      matchId: string;
      faction1: FaceitPlayer[];
      faction2: FaceitPlayer[];
      message: string;
    }
  | {
      status: "error";
      matchId?: string;
      code: string;
      message: string;
    };
