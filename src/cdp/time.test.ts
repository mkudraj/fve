/**
 * Tests for the CDP monotonic timestamp -> wall clock conversion.
 * Guards against the "1970-01-01" bug.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { wallTimeFromMonotonic, normalizeIso, type TimeAnchor } from "./time.js";

test("wallTimeFromMonotonic - does not produce 1970 and matches a marker", () => {
  // An anchor captured at a known wall moment.
  const anchorAt = new Date("2026-08-04T08:10:00.000Z");
  const anchor: TimeAnchor = {
    wallIso: anchorAt.toISOString(),
    monotonicSec: 12345678.5,
  };

  // An event 5 seconds later in monotonic time.
  const result = wallTimeFromMonotonic(12345683.5, anchor);
  const d = new Date(result);

  assert.strictEqual(d.getFullYear(), 2026, "year is correct, not 1970");
  assert.strictEqual(d.toISOString(), "2026-08-04T08:10:05.000Z", "off by +5s");

  // Compare with a manual marker taken at the event moment.
  const manualMarker = new Date("2026-08-04T08:10:05.000Z").toISOString();
  assert.strictEqual(
    new Date(result).getTime(),
    new Date(manualMarker).getTime(),
    "matches the manually recorded marker",
  );
});

test("wallTimeFromMonotonic - handles event before anchor (negative diff)", () => {
  const anchor: TimeAnchor = {
    wallIso: "2026-08-04T08:10:00.000Z",
    monotonicSec: 100,
  };
  const result = wallTimeFromMonotonic(99, anchor);
  assert.strictEqual(result, "2026-08-04T08:09:59.000Z");
});

test("normalizeIso - clamps a 1970-style epoch away from 1970", () => {
  // 0 (or a tiny value) is the classic 1970-01-01 bug source.
  // For numeric input the function substitutes the current time, NOT 1970.
  const result = normalizeIso(0, "2026-08-04T08:10:00.000Z");
  assert.notStrictEqual(new Date(result).getFullYear(), 1970, "never emits 1970");

  // For string input an obviously-invalid epoch is replaced with the fallback.
  const epoch1970 = normalizeIso("1970-01-01T00:00:00.000Z", "2026-08-04T08:10:00.000Z");
  assert.strictEqual(epoch1970, "2026-08-04T08:10:00.000Z", "1970 string is replaced with fallback");
});

test("normalizeIso - keeps a valid modern ISO", () => {
  const result = normalizeIso("2026-08-04T09:00:00.000Z");
  assert.strictEqual(result, "2026-08-04T09:00:00.000Z");
});

test("normalizeIso - returns fallback when value absent", () => {
  const fallback = "2026-08-04T10:00:00.000Z";
  assert.strictEqual(normalizeIso(undefined, fallback), fallback);
});
