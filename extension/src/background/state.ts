/**
 * Background state machine for the extension.
 *
 * Manages the MatchScoutState lifecycle:
 *   idle -> match-detected -> loading -> ready | partial | error
 */

import type { MatchScoutState, FaceitPlayer } from "@fve/core";

let currentState: MatchScoutState = { status: "idle" };

export function getState(): MatchScoutState {
  return currentState;
}

export function transitionToDetected(matchId: string): void {
  currentState = {
    status: "match-detected",
    matchId,
    detectedAt: Date.now(),
  };
}

export function transitionToLoading(): void {
  if (currentState.status !== "match-detected") return;
  currentState = {
    status: "loading",
    matchId: currentState.matchId,
    detectedAt: currentState.detectedAt,
  };
}

export function transitionToReady(
  faction1: FaceitPlayer[],
  faction2: FaceitPlayer[],
  matchStatus: string,
): void {
  const base =
    currentState.status === "loading" || currentState.status === "match-detected"
      ? currentState
      : { matchId: "unknown", detectedAt: 0 };

  currentState = {
    status: "ready",
    matchId: base.matchId,
    detectedAt: base.detectedAt,
    loadedAt: Date.now(),
    matchStatus,
    faction1,
    faction2,
  };
}

export function transitionToPartial(
  faction1: FaceitPlayer[],
  faction2: FaceitPlayer[],
  message: string,
): void {
  const matchId =
    currentState.status !== "idle" ? currentState.matchId : undefined;

  currentState = {
    status: "partial",
    matchId: matchId ?? "unknown",
    faction1,
    faction2,
    message,
  };
}

export function transitionToError(code: string, message: string): void {
  const matchId =
    currentState.status !== "idle" ? currentState.matchId : undefined;

  currentState = {
    status: "error",
    matchId,
    code,
    message,
  };
}

export function resetToIdle(): void {
  currentState = { status: "idle" };
}
