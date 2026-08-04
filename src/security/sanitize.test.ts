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
  sanitizePostData,
  sanitizeStorageData,
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

test("sanitizePostData - masks secrets in JSON and plain text", () => {
  const json = sanitizePostData(
    JSON.stringify({ access_token: "tok_xyz", match_id: "m1", password: "hunter2" }),
  );
  assert.ok(!json.includes("tok_xyz"), "access_token masked");
  assert.ok(!json.includes("hunter2"), "password masked");
  assert.ok(json.includes("m1"), "match_id preserved");

  const plain = sanitizePostData("token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature");
  assert.ok(!plain.includes("eyJhbGci"), "JWT masked in plain text");
});

test("sanitizeStorageData - masks sensitive keys and nested tokens", () => {
  const clean = sanitizeStorageData({
    session_token: "tok_session",
    auth: JSON.stringify({ refresh: "rtok" }),
    user: JSON.stringify({ nickname: "TestUser", player_id: "p1", access_token: "tok_xyz" }),
    match_id: "m-1",
    config: "plain value",
  });
  assert.strictEqual(clean.session_token, "[REDACTED]", "session_token masked");
  assert.ok(!clean.auth.includes("rtok"), "nested refresh masked");
  assert.ok(!clean.user.includes("tok_xyz"), "nested access_token masked");
  assert.ok(clean.user.includes("TestUser"), "nickname preserved");
  assert.ok(clean.user.includes("p1"), "player_id preserved");
  assert.strictEqual(clean.match_id, "m-1", "match_id preserved");
  assert.strictEqual(clean.config, "plain value", "non-sensitive preserved");
});
