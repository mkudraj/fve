/**
 * Tests for security sanitization module.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sanitizeHeaders,
  sanitizeUrl,
  sanitizeResponseBody,
  sanitizeWebSocketFrame,
} from "./sanitize.js";

test("sanitizeHeaders - masks Authorization header", () => {
  const result = sanitizeHeaders({
    "content-type": "application/json",
    Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    Cookie: "session_id=abc123; token=xyz",
  });

  assert.ok(result["content-type"] === "application/json", "non-sensitive headers preserved");
  assert.ok(!result.Authorization.includes("eyJ"), "Authorization token masked");
  assert.ok(result.Authorization === "[REDACTED]", "Authorization fully redacted");
  assert.ok(!result.Cookie.includes("abc123"), "Cookie values masked");
});

test("sanitizeHeaders - handles empty object", () => {
  const result = sanitizeHeaders({});
  assert.deepStrictEqual(result, {});
});

test("sanitizeUrl - removes query tokens", () => {
  const clean = sanitizeUrl("https://api.faceit.com/match?token=secret123&id=xyz");
  assert.ok(!clean.includes("secret123"), "token value removed");
  assert.ok(clean.includes("id=xyz"), "non-sensitive params preserved");
});

test("sanitizeUrl - preserves clean URLs", () => {
  const clean = sanitizeUrl("https://www.faceit.com/en/play");
  assert.strictEqual(clean, "https://www.faceit.com/en/play");
});

test("sanitizeResponseBody - masks JWT tokens in JSON", () => {
  const body = JSON.stringify({
    access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
    match_id: "abc-def-ghi",
      users: [{ name: "TestUser", session_id: "sess_12345" }],
  });

  const sanitized = sanitizeResponseBody(body);
  assert.ok(!sanitized.includes("eyJhbGci"), "JWT token masked");
  assert.ok(sanitized.includes("abc-def-ghi"), "match_id preserved");
  assert.ok(sanitized.includes("TestUser"), "user names preserved");
  assert.ok(!sanitized.includes("sess_12345"), "session ID masked");
});

test("sanitizeResponseBody - handles non-JSON text", () => {
  const text = "plain text no secrets here";
  const sanitized = sanitizeResponseBody(text);
  assert.strictEqual(sanitized, text);
});

test("sanitizeWebSocketFrame - masks tokens in frame data", () => {
  const frame = JSON.stringify({
    type: "match_update",
    payload: { token: "sk-abc123secret" },
  });

  const sanitized = sanitizeWebSocketFrame(frame);
  assert.ok(!sanitized.includes("sk-abc123secret"), "token masked in WS frame");
  assert.ok(sanitized.includes("match_update"), "non-sensitive frame data preserved");
});

test("sanitizeWebSocketFrame - handles empty frames", () => {
  const result = sanitizeWebSocketFrame("");
  assert.strictEqual(result, "");
});
