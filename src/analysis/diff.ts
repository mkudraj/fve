/**
 * Semantic diff between pre-accept and post-accept match payloads.
 *
 * Compares two parsed JSON documents and reports:
 *  - paths only present after Accept (added)
 *  - paths whose value changed between pre and post
 *  - when a roster was first observed
 */

export interface DiffEntry {
  path: string;
  kind: "added" | "changed";
  preValue: string | null;
  postValue: string;
}

export interface ApiDiff {
  source: string;
  compared: {
    pre: string | null;
    post: string | null;
  };
  additions: DiffEntry[];
  changes: DiffEntry[];
  rosterFirstSeen: string | null;
  playerCount: number;
}

const IGNORED_KEYS = new Set([
  "rosterWithSubstitutes",
]);

function pathOf(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function collectLeafPaths(
  node: unknown,
  path: string,
  out: Map<string, { exists: boolean; value: unknown; json: string; hasPlayer: boolean }>,
): void {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    // Represent arrays by their element counts + inspect players.
    const key = path || "(root)";
    out.set(key, {
      exists: true,
      value: node,
      json: JSON.stringify(node),
      hasPlayer: node.some(
        (x) =>
          x &&
          typeof x === "object" &&
          !Array.isArray(x) &&
          Object.keys(x as Record<string, unknown>).some((k) =>
            ["nickname", "player_id", "playerid", "steam_id_64", "game_player_id"].includes(k.toLowerCase()),
          ),
      ),
    });
    node.forEach((item, i) => collectLeafPaths(item, `${path}[${i}]`, out));
    return;
  }

  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      if (IGNORED_KEYS.has(lower)) continue;
      const sub = pathOf(path, key);
      const value = obj[key];
      if (value && typeof value === "object") {
        collectLeafPaths(value, sub, out);
      } else {
        out.set(sub, { exists: true, value, json: String(value), hasPlayer: false });
      }
    }
  }
}

/**
 * Compare two parsed payloads. If either is null/missing, treat as no data.
 */
export function diffPrePost(
  source: string,
  preRaw: unknown,
  postRaw: unknown,
  preTimestamp: string | null,
  postTimestamp: string | null,
): ApiDiff {
  const preMap = new Map<string, { exists: boolean; value: unknown; json: string; hasPlayer: boolean }>();
  const postMap = new Map<string, { exists: boolean; value: unknown; json: string; hasPlayer: boolean }>();

  if (preRaw !== null && preRaw !== undefined) collectLeafPaths(preRaw, "", preMap);
  if (postRaw !== null && postRaw !== undefined) collectLeafPaths(postRaw, "", postMap);

  const additions: DiffEntry[] = [];
  const changes: DiffEntry[] = [];
  let rosterFirstSeen: string | null = null;
  let playerCount = 0;

  for (const [path, post] of postMap) {
    const pre = preMap.get(path);
    if (!pre) {
      additions.push({ path, kind: "added", preValue: null, postValue: post.json });
      if (post.hasPlayer && !rosterFirstSeen) rosterFirstSeen = postTimestamp;
      if (post.hasPlayer) playerCount++;
    } else if (pre.json !== post.json) {
      changes.push({ path, kind: "changed", preValue: pre.json, postValue: post.json });
    }
  }

  return { source, compared: { pre: preTimestamp, post: postTimestamp }, additions, changes, rosterFirstSeen, playerCount };
}
