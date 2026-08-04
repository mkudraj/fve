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
}

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
