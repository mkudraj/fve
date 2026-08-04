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
