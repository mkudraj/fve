/**
 * Tests for the pre/post Accept semantic diff.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { diffPrePost } from "./diff.js";

const ROOKIE_URL = "open.faceit.com/data/v4/matches";

test("diffPrePost - reports added roster and player fields after Accept", () => {
  const pre = {
    matchId: "1-ed06863c-ee54-4fe1-9278-475d72991017",
    status: "CONFIGURING",
  };
  const post = {
    matchId: "1-ed06863c-ee54-4fe1-9278-475d72991017",
    status: "LIVE",
    teams: [
      { roster: [{ nickname: "Alpha", player_id: "p1" }] },
    ],
  };

  const d = diffPrePost(ROOKIE_URL, pre, post, "t-pre", "t-post");
  assert.strictEqual(d.source, ROOKIE_URL);
  assert.ok(d.additions.some((a) => a.path.includes("teams")), "teams added");
  assert.ok(d.additions.some((a) => a.path.includes("roster")), "roster added");
  assert.ok(d.additions.some((a) => a.path.includes("nickname")), "nickname added");
  assert.ok(d.changes.some((c) => c.path === "status"), "status changed");
  assert.strictEqual(d.rosterFirstSeen, "t-post");
  assert.ok(d.playerCount >= 1);
});

test("diffPrePost - ignores rosterWithSubstitutes boolean key", () => {
  const pre = { checkIn: { rosterWithSubstitutes: false } };
  const post = { checkIn: { rosterWithSubstitutes: true } };
  const d = diffPrePost(ROOKIE_URL, pre, post, null, null);
  assert.ok(
    !d.additions.some((a) => a.path.includes("rosterWithSubstitutes")),
    "rosterWithSubstitutes is skipped",
  );
  assert.strictEqual(d.rosterFirstSeen, null);
});

test("diffPrePost - handles null pre payload (pre never fetched)", () => {
  const post = { players: [{ nickname: "Solo" }] };
  const d = diffPrePost(ROOKIE_URL, null, post, null, "t-post");
  assert.ok(d.additions.length > 0, "all post fields seen as additions");
});

test("diffPrePost - identical payloads produce no changes", () => {
  const same = { matchId: "1-aaa", status: "LIVE" };
  const d = diffPrePost(ROOKIE_URL, same, { ...same }, "t1", "t2");
  assert.strictEqual(d.additions.length, 0);
  assert.strictEqual(d.changes.length, 0);
});
