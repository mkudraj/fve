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

/** Aggregated stats from recent Leetify matches. */
export interface MatchStats {
  matchesAnalyzed: number;
  totalMatches: number;
  winRate: number | null;
  kdRatio: number | null;
  killsPerRound: number | null;
  adr: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  leetifyProfileUrl: string | null;
  /** Average Leetify rating across analyzed matches. */
  avgRating: number | null;
  /** Rating change (latest rating - oldest rating). */
  ratingSwing: number | null;
  /** Performance summary for matches in the last 24 hours. */
  last24h: Last24hPerformance | null;
}

export interface Last24hPerformance {
  games: number;
  label: string; // e.g. "consistent", "inconsistent", "no data"
  detail: string; // e.g. "playing consistently across 7 games"
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
