/**
 * Tests for Leetify client.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractAimRating,
  classifyLeetifyError,
  fetchLeetifyProfile,
} from "./leetify-client.js";

// ---- extractAimRating ----

test("extractAimRating - extracts top-level aimRating (new recent-games/5v5 format)", () => {
  const data = {
    aimRating: 89.8,
    winRate: 0.57,
    kdRatio: 1.15,
  };
  assert.strictEqual(extractAimRating(data), 89.8);
});

test("extractAimRating - aimRating of 0 is valid (not N/A)", () => {
  assert.strictEqual(extractAimRating({ aimRating: 0 }), 0);
});

test("extractAimRating - legacy recentGameRatings.aim still works as fallback", () => {
  const data = {
    recentGameRatings: { aim: 81.4, positioning: 57.1 },
  };
  assert.strictEqual(extractAimRating(data), 81.4);
});

test("extractAimRating - legacy aim of 0 is valid (not N/A)", () => {
  const data = { recentGameRatings: { aim: 0 } };
  assert.strictEqual(extractAimRating(data), 0);
});

test("extractAimRating - missing aim fields return null", () => {
  assert.strictEqual(extractAimRating({ name: "test" }), null);
  assert.strictEqual(extractAimRating({ recentGameRatings: { positioning: 50 } }), null);
});

test("extractAimRating - aim is not a number returns null", () => {
  assert.strictEqual(extractAimRating({ aimRating: "81" }), null);
  assert.strictEqual(extractAimRating({ aimRating: null }), null);
  assert.strictEqual(extractAimRating({ recentGameRatings: { aim: "81" } }), null);
  assert.strictEqual(extractAimRating({ recentGameRatings: { aim: null } }), null);
});

test("extractAimRating - aim is NaN or Infinity returns null", () => {
  assert.strictEqual(extractAimRating({ aimRating: NaN }), null);
  assert.strictEqual(extractAimRating({ aimRating: Infinity }), null);
  assert.strictEqual(extractAimRating({ recentGameRatings: { aim: NaN } }), null);
  assert.strictEqual(extractAimRating({ recentGameRatings: { aim: Infinity } }), null);
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

test("classifyLeetifyError - unavailable not-found", () => {
  const msg = classifyLeetifyError({
    status: "unavailable",
    reason: "not-found",
  });
  assert.ok(msg.includes("not found"), msg);
});

// ---- fetchLeetifyProfile (new recent-games/5v5 endpoint) ----

test("fetchLeetifyProfile - parses top-level aimRating from recent-games/5v5", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ aimRating: 89.8, winRate: 0.57, kdRatio: 1.15 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  try {
    const result = await fetchLeetifyProfile("76561198249664530");
    assert.strictEqual(result.status, "success");
    if (result.status === "success") {
      assert.strictEqual(result.aim, 89.8);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchLeetifyProfile - 404 maps to unavailable not-found", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not found", { status: 404 });
  try {
    const result = await fetchLeetifyProfile("76561198000000000");
    assert.strictEqual(result.status, "unavailable");
    if (result.status === "unavailable") {
      assert.strictEqual(result.reason, "not-found");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchLeetifyProfile - no aimRating in response maps to unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ winRate: 0.5 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    const result = await fetchLeetifyProfile("76561198249664530");
    assert.strictEqual(result.status, "unavailable");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Note: match stats now come from FACEIT (faceit-stats.ts) - Leetify is used
// only for the Aim Rating.
