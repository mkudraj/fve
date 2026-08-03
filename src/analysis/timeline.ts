/**
 * Build a chronological timeline from markers, events, and hits.
 */
import type { NetworkEvent, TimeMarker, MatchHit } from "../types/index.js";

export interface TimelineEntry {
  timestamp: string;
  type: "marker" | "event" | "hit";
  label: string;
  detail: string;
}

export function buildTimeline(
  markers: TimeMarker[],
  events: NetworkEvent[],
  hits: MatchHit[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const m of markers) {
    entries.push({
      timestamp: m.timestamp,
      type: "marker",
      label: m.label,
      detail: `[${m.key}]`,
    });
  }

  for (const e of events) {
    if (e.responseBody || e.wsFrameData) {
      entries.push({
        timestamp: e.timestamp,
        type: "event",
        label: `${e.source}: ${e.url.substring(0, 80)}`,
        detail: e.responseBody
          ? `body ${e.responseBody.length}B`
          : `ws frame ${e.wsFrameData?.length}B`,
      });
    }
  }

  for (const h of hits) {
    entries.push({
      timestamp: h.timestamp,
      type: "hit",
      label: `${h.phase === "pre-reveal" ? "PRE" : "POST"}: ${h.path}`,
      detail: h.value.substring(0, 120),
    });
  }

  // Sort by timestamp
  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return entries;
}
