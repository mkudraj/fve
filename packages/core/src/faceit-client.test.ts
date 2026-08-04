/**
 * Tests for FACEIT Data API client classification.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyApiStatus, isRetryable } from "./faceit-client.js";

test("classifyApiStatus - 200 is OK", () => {
  assert.strictEqual(classifyApiStatus(200), "OK");
});

test("classifyApiStatus - 401 is AUTH_ERROR", () => {
  assert.strictEqual(classifyApiStatus(401), "AUTH_ERROR");
});

test("classifyApiStatus - 403 is AUTH_ERROR", () => {
  assert.strictEqual(classifyApiStatus(403), "AUTH_ERROR");
});

test("classifyApiStatus - 404 is NOT_FOUND", () => {
  assert.strictEqual(classifyApiStatus(404), "NOT_FOUND");
});

test("classifyApiStatus - 429 is RATE_LIMITED", () => {
  assert.strictEqual(classifyApiStatus(429), "RATE_LIMITED");
});

test("classifyApiStatus - 500 is SERVER_ERROR", () => {
  assert.strictEqual(classifyApiStatus(500), "SERVER_ERROR");
});

test("classifyApiStatus - 502 is SERVER_ERROR", () => {
  assert.strictEqual(classifyApiStatus(502), "SERVER_ERROR");
});

test("isRetryable - 404 is retryable", () => {
  assert.strictEqual(isRetryable(404), true);
});

test("isRetryable - 0 (network error) is retryable", () => {
  assert.strictEqual(isRetryable(0), true);
});

test("isRetryable - 503 is retryable", () => {
  assert.strictEqual(isRetryable(503), true);
});

test("isRetryable - 401 is NOT retryable", () => {
  assert.strictEqual(isRetryable(401), false);
});

test("isRetryable - 403 is NOT retryable", () => {
  assert.strictEqual(isRetryable(403), false);
});

test("isRetryable - 429 is NOT retryable (avoid aggressive retry)", () => {
  assert.strictEqual(isRetryable(429), false);
});

test("isRetryable - 200 is NOT retryable", () => {
  assert.strictEqual(isRetryable(200), false);
});
