/**
 * Tests for Leetify client.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAimRating, classifyLeetifyError } from "./leetify-client.js";

// ---- extractAimRating ----

test("extractAimRating - extracts rating.aim from ProfileResponse", () => {
  const data = {
    rating: { aim: 81.4, positioning: 57.1 },
  };
  assert.strictEqual(extractAimRating(data), 81.4);
});

test("extractAimRating - aim of 0 is valid (not N/A)", () => {
  const data = { rating: { aim: 0 } };
  assert.strictEqual(extractAimRating(data), 0);
});

test("extractAimRating - missing rating returns null", () => {
  assert.strictEqual(extractAimRating({ name: "test" }), null);
});

test("extractAimRating - missing aim field returns null", () => {
  assert.strictEqual(extractAimRating({ rating: { positioning: 50 } }), null);
});

test("extractAimRating - aim is not a number returns null", () => {
  assert.strictEqual(extractAimRating({ rating: { aim: "81" } }), null);
  assert.strictEqual(extractAimRating({ rating: { aim: null } }), null);
});

test("extractAimRating - aim is NaN or Infinity returns null", () => {
  assert.strictEqual(extractAimRating({ rating: { aim: NaN } }), null);
  assert.strictEqual(extractAimRating({ rating: { aim: Infinity } }), null);
});

test("extractAimRating - null input returns null", () => {
  assert.strictEqual(extractAimRating(null), null);
  assert.strictEqual(extractAimRating(undefined), null);
});

test("extractAimRating - non-object input returns null", () => {
  assert.strictEqual(extractAimRating(42), null);
  assert.strictEqual(extractAimRating("string"), null);
});

// ---- classifyLeetifyError ----

test("classifyLeetifyError - auth-error", () => {
  const msg = classifyLeetifyError({ status: "auth-error" });
  assert.ok(msg.includes("invalid"), msg);
});

test("classifyLeetifyError - rate-limited", () => {
  const msg = classifyLeetifyError({ status: "rate-limited" });
  assert.ok(msg.includes("rate"), msg);
});

test("classifyLeetifyError - temporary-error with message", () => {
  const msg = classifyLeetifyError({
    status: "temporary-error",
    message: "connection refused",
  });
  assert.strictEqual(msg, "connection refused");
});

test("classifyLeetifyError - unavailable private", () => {
  const msg = classifyLeetifyError({
    status: "unavailable",
    reason: "private",
  });
  assert.ok(msg.includes("private"), msg);
});

test("classifyLeetifyError - unavailable not-registered", () => {
  const msg = classifyLeetifyError({
    status: "unavailable",
    reason: "not-registered",
  });
  assert.ok(msg.includes("not registered"), msg);
});

test("classifyLeetifyError - unavailable not-found", () => {
  const msg = classifyLeetifyError({
    status: "unavailable",
    reason: "not-found",
  });
  assert.ok(msg.includes("not found"), msg);
});
