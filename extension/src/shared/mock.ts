/**
 * Mock match state used by the "Preview overlay" feature.
 * Shared between the popup and the standalone preview page.
 */
import type { MatchScoutState } from "@fve/core";

export function buildMockState(): MatchScoutState {
  return {
    status: "ready",
    matchId: "1-ed06863c-ee54-4fe1-9278-475d72991017",
    detectedAt: Date.now() - 500,
    loadedAt: Date.now(),
    matchStatus: "CHECK_IN",
    faction1: [
      { nickname: "GR1NA", playerId: "p1", steamId64: "76561198249664530", steamName: "Gringo", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 89.8 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 4314, winRate: 0.43, kdRatio: 0.91, killsPerRound: 0.67, adr: 73.0, headshotRate: 52 } } },
      { nickname: "siNCo-", playerId: "p2", steamId64: "76561198119694078", steamName: "siNCo", level: 10, membership: "free", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 85.3 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 3646, winRate: 0.5, kdRatio: 1.05, killsPerRound: 0.7, adr: 78.3, headshotRate: 56 } } },
      { nickname: "-AthE", playerId: "p3", steamId64: "76561198838634986", steamName: "AthE", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 91.8 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 5210, winRate: 0.52, kdRatio: 1.18, killsPerRound: 0.74, adr: 76.4, headshotRate: 58 } } },
      { nickname: "-T0KI", playerId: "p4", steamId64: "76561198838474668", steamName: "T0KI", level: 10, membership: "free", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 91.8 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 2875, winRate: 0.47, kdRatio: 0.98, killsPerRound: 0.65, adr: 69.8, headshotRate: 49 } } },
      { nickname: "Ceo---", playerId: "p5", steamId64: "76561198362845213", steamName: "Ceo", level: 10, membership: "premium", anticheatRequired: true, team: "team_GR1NA", aim: { status: "available", value: 76.4 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 4102, winRate: 0.55, kdRatio: 1.12, killsPerRound: 0.71, adr: 74.1, headshotRate: 54 } } },
    ],
    faction2: [
      { nickname: "108-", playerId: "p6", steamId64: "76561198782132866", steamName: "108", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 88.7 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 1834, winRate: 0.49, kdRatio: 1.02, killsPerRound: 0.66, adr: 71.5, headshotRate: 51 } } },
      { nickname: "shorstky", playerId: "p7", steamId64: "76561198070756713", steamName: "shorstky", level: 10, membership: "premium", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 80 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 6742, winRate: 0.58, kdRatio: 1.24, killsPerRound: 0.78, adr: 81.2, headshotRate: 60 } } },
      { nickname: "tumi", playerId: "p8", steamId64: "76561198035293177", steamName: "tumi", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 85.8 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 1508, winRate: 0.44, kdRatio: 0.93, killsPerRound: 0.62, adr: 66.7, headshotRate: 46 } } },
      { nickname: "shadyb", playerId: "p9", steamId64: "76561198080436813", steamName: "shadyb", level: 10, membership: "premium", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 88.9 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 3219, winRate: 0.51, kdRatio: 1.08, killsPerRound: 0.69, adr: 72.9, headshotRate: 53 } } },
      { nickname: "AHLIN-", playerId: "p10", steamId64: "76561198108255427", steamName: "AHLIN", level: 10, membership: "free", anticheatRequired: true, team: "team_108-", aim: { status: "available", value: 86 }, matchStats: { status: "available", stats: { matchesAnalyzed: 20, totalMatches: 2560, winRate: 0.46, kdRatio: 0.95, killsPerRound: 0.64, adr: 68.3, headshotRate: 47 } } },
    ],
    aimTiming: {
      requestsStartedAt: Date.now() - 500,
      firstAimLoadedAt: Date.now() - 200,
      allAimRequestsFinishedAt: Date.now(),
      availableAimCount: 6,
      unavailableAimCount: 2,
      errorAimCount: 1,
    },
  };
}
