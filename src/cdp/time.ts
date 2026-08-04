/**
 * CDP time conversion.
 *
 * CDP `Network.*` events carry a `timestamp` field (in seconds) that is a
 * browser-monotonic clock, NOT a Unix epoch. Interpreting it directly as a
 * Unix epoch produces bogus dates like 1970-01-01.
 *
 * The correct approach: capture a reference point (`wallTime` + monotonic
 * timestamp) from a request that provides it (e.g. a `Network.loadingFailed`
 * or the first request where the page supplies wall time), then anchor other
 * events by offsetting the monotonic difference.
 */

export interface TimeAnchor {
  /** Real-world ISO string captured at the moment the anchor was observed. */
  wallIso: string;
  /** Monotonic CDP timestamp (seconds) at the same moment. */
  monotonicSec: number;
}

/**
 * Returns wall-clock ISO string for a CDP event given:
 *  - the event's monotonic `timestamp` (seconds)
 *  - a reference time captured with `new Date()` around the same moment
 *    (ISO string) and that event's monotonic timestamp
 */
export function wallTimeFromMonotonic(
  eventMonotonicSec: number,
  anchor: TimeAnchor,
): string {
  const wallMs = new Date(anchor.wallIso).getTime();
  const diffMs = (eventMonotonicSec - anchor.monotonicSec) * 1000;
  return new Date(wallMs + diffMs).toISOString();
}

/**
 * Renders an ISO timestamp, clamping absurd values (near-zero epoch) to the
 * provided fallback. Used defensively if a timestamp is missing.
 */
export function normalizeIso(
  ts: string | number | undefined,
  fallbackIso = new Date().toISOString(),
): string {
  if (typeof ts === "number") {
    const d = new Date(ts);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1971) return d.toISOString();
    return new Date().toISOString();
  }
  if (typeof ts === "string") {
    const d = new Date(ts);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1971) return d.toISOString();
    return fallbackIso;
  }
  return fallbackIso;
}
