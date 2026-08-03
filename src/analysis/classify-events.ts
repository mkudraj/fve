/**
 * Classify network events and hits as pre-reveal or post-reveal
 * based on manual time markers from the user.
 */
import type { NetworkEvent, TimeMarker, MatchHit } from "../types/index.js";

export function classifyHits(hits: MatchHit[], markers: TimeMarker[]): MatchHit[] {
  const revealMarker = markers.find((m) => m.key === "reveal");
  if (!revealMarker) return hits;

  const revealTime = new Date(revealMarker.timestamp).getTime();

  return hits.map((hit) => ({
    ...hit,
    phase: new Date(hit.timestamp).getTime() < revealTime ? "pre-reveal" : "post-reveal",
  }));
}

export function findPreRevealHits(hits: MatchHit[]): MatchHit[] {
  return hits.filter((h) => h.phase === "pre-reveal");
}

export function findPostRevealHits(hits: MatchHit[]): MatchHit[] {
  return hits.filter((h) => h.phase === "post-reveal");
}

export interface ClassificationResult {
  preRevealCount: number;
  postRevealCount: number;
  unknownCount: number;
  preRevealKeys: Set<string>;
  postRevealKeys: Set<string>;
}

export function summarizeClassification(hits: MatchHit[]): ClassificationResult {
  const result: ClassificationResult = {
    preRevealCount: 0,
    postRevealCount: 0,
    unknownCount: 0,
    preRevealKeys: new Set(),
    postRevealKeys: new Set(),
  };

  for (const hit of hits) {
    if (hit.phase === "pre-reveal") {
      result.preRevealCount++;
      result.preRevealKeys.add(hit.path);
    } else if (hit.phase === "post-reveal") {
      result.postRevealCount++;
      result.postRevealKeys.add(hit.path);
    } else {
      result.unknownCount++;
    }
  }

  return result;
}
