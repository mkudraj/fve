# FACEIT Data API — detecting players before Accept — full implementation details

This document is a complete specification for an AI agent to build a Chrome extension **or** desktop app that retrieves FACEIT player rosters before accepting a match.

---

## 1. Verdict / investigation conclusion

**CASE_A — YES.** Knowing the `matchId` (full, with `1-` prefix) before clicking Accept, you can fetch the **full roster of both teams (10 players)** via the **official, public FACEIT Data API**:

```
GET https://open.faceit.com/data/v4/matches/{matchId}
Authorization: Bearer <FACEIT_API_KEY>
Accept: application/json
```

- Returns `HTTP 200` with the full roster even during the `status: "CHECK_IN"` phase (before the match fully starts).
- Each player: `nickname`, `player_id`, `game_player_id` (= **SteamID64**), `game_skill_level`, `anticheat_required`, `membership`.
- **Does not require** bypassing security, sharing sessions, or using undocumented endpoints.

---

## 2. Critical technical requirements (learned from real testing)

1. **The `1-` prefix is mandatory.** The Data API returns `404` for a bare UUID:
   - `1-0ce0d100-d493-484d-9a91-332a1c865942` → `200` ✅
   - `0ce0d100-d493-484d-9a91-332a1c865942` → `404` ❌

2. **Anti-false-positive matchId.** FACEIT traffic contains many bare UUIDs that are NOT matchIds, e.g. `community_id` from the `searchCommunityLobbies?community_id=7dbcab58-...` endpoint. **Do not** treat these as matchIds. A valid matchId is a UUID with a `<number>-` prefix:

```regex
^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
```

3. **Where to find matchId in live traffic:** URLs of internal endpoints sent by the page (no rewriting needed):

```
https://www.faceit.com/api/match/v4/match/1-<matchId>
https://www.faceit.com/api/match/v1/checkin/1-<matchId>
```

These requests appear when a match is found and the Accept button is visible.

4. **Session regeneration**: the internal payload may also contain a bare id (`0ce0d100...`) in the `payload.id` field — for the Data API, **always** use the prefixed version.

---

## 3. Data available from the Data API (JSON structure)

A `200` response includes, among other things:

```jsonc
{
  "match_id": "1-0ce0d100-...",
  "game": "cs2",
  "region": "EU",
  "competition_name": "Europe 5v5 Queue",
  "status": "CHECK_IN",
  "best_of": 1,
  "chat_room_id": "match-1-0ce0d100-...",
  "faceit_url": "https://www.faceit.com/{lang}/cs2/room/1-0ce0d100-...",
  "teams": {
    "faction1": {
      "faction_id": "...",
      "leader": "...",
      "name": "team_GR1NA",
      "roster": [
        {
          "player_id": "9c3b4375-...",
          "nickname": "GR1NA",
          "membership": "premium",
          "game_player_id": "76561198249664530",   // <-- SteamID64
          "game_player_name": "Gringo",
          "game_skill_level": 10,
          "anticheat_required": true
        }
        // ... 5 players
      ],
      "stats": {
        "winProbability": 0.5,
        "skillLevel": { "average": 10 },
        "rating": 2672
      }
    },
    "faction2": { /* analogously, 5 players */ }
  }
}
```

**Field-to-identifier mapping:**

| What | Field in Data API |
|------|-------------------|
| Nickname | `teams.factionN.roster[].nickname` |
| FACEIT Player ID | `teams.factionN.roster[].player_id` |
| **SteamID64** | `teams.factionN.roster[].game_player_id` |
| Steam name | `teams.factionN.roster[].game_player_name` |
| Level / skill | `teams.factionN.roster[].game_skill_level` |
| Team | `teams.faction1` / `teams.faction2` (and `name` within) |

Note: `game_player_id` is the **SteamID64** — do not confuse it with `player_id` (the FACEIT id). In the internal (unofficial) API, the field would be called `steam_id_64`, but in the official Data API it is `game_player_id`.

---

## 4. The `FACEIT_API_KEY`

- Developer key from <https://developers.faceit.com>.
- Passed exclusively via the `Authorization: Bearer <KEY>` header.
- **Never log / never persist** the key value. Handle: `401`/`403` → invalid key (message "check your key"), `429` → rate-limit (backoff), `404` → match not public, timeout.
- Recommended timeout: e.g. 8–10 s.

---

## 5. Recommendation: Chrome extension vs desktop app

**Recommendation: Chrome Extension** (Manifest V3), because:
- It needs to detect the matchId from page traffic **on the FACEIT platform in the browser** — the extension has natural access (webRequest / declarativeNetRequest / DOM monitoring).
- Does not violate any terms (public endpoint).
- Fastest distribution and simplicity.
- The Data API only requires a key, stored in `chrome.storage.local`.

Possible hybrid: **Chrome extension + optional local notifier** (notification / sound alert). A desktop app is not necessary.

**When a desktop app would make sense:** if we wanted additional integrations outside the browser (not needed here).

> Decision: **Chrome Extension (Manifest V3)** as MVP.

---

## 6. Proposed Chrome extension architecture (MV3)

```
manifest.json (MV3)
├─ permissions: ["storage","alarms","notifications","webRequest"] + host_permissions:
│    https://www.faceit.com/* , https://open.faceit.com/*
├─ background service worker (matchId detection, Data API call, alarm)
├─ content script (optional: DOM observation for matchId / Accept button)
└─ popup (status + loaded player list)
```

**Flow:**

1. Background listens for network requests to `www.faceit.com/api/match/v4/match/*` or `*/checkin/*`.
2. Extracts `1-<uuid>` from the URL (regex from section 2).
3. Stores the last detected matchId in `chrome.storage.local`.
4. Immediately upon detection, calls `open.faceit.com/data/v4/matches/<matchId>` with the key.
5. Parses `teams.faction1/faction2.roster`, saves to storage, shows in popup + notification.
6. Repeats every ~1–2 s (alarm) until `status` changes, so the roster is always up-to-date.

The "Accept" button mechanically stays on the user's side — the extension only **reads** the public API.

---

## 7. Error handling / edge cases

- **401/403** → invalid key; popup asks to check `FACEIT_API_KEY`.
- **404** → match is not (yet) public; retry with backoff (e.g. 500 ms → 1.5 s → stop), or too early.
- **429** → rate-limit; wait according to `Retry-After`, do not spam.
- **Timeout/network** → retry, do not freeze the UI.
- **`status` change from `CHECK_IN` to `VOTING`/`CONFIGURING`** → roster is complete; stop polling as frequently.
- **Missing prefix** in the found id → ignore (it is not a matchId, e.g. `community_id`).

---

## 8. Project structure (repo `fve`, TypeScript)

Key modules already existing (logic can be ported to the extension):

- `src/analysis/match-id.ts` — `extractMatchId`, `detectMatchId`, `MATCH_ID_WITH_PREFIX` regex, bare UUID exclusion.
- `src/faceit/data-api-client.ts` — `fetchMatchData` (timeout, auth, sanitization), `classifyDataApiResult` (200/404/401/403/429).
- `src/analysis/roster.ts` — player extraction: `nickname`, `player_id`, `game_player_id` → `steamId64`, team, JSON path; rejects `rosterWithSubstitutes:false`.
- `src/analysis/diff.ts` — pre/post accept comparison.
- Tests: 51 unit tests (Node `node:test`).

### Real-world tested (fixture) — roster from Data API before Accept

- Team 1 (GR1NA): `GR1NA` (`76561198249664530`), `siNCo-` (`76561198119694078`), `-AthE` (`76561198838634986`), `-T0KI` (`76561198838474668`), `Ceo---` (`76561198362845213`)
- Team 2: `108-` (`76561198782132866`), `shorstky` (`76561198070756713`), `tumi` (`76561198035293177`), `shadyb` (`76561198080436813`), `AHLIN-` (`76561198108255427`)

---

## 9. Test / verification procedure for a new agent

1. Launch Chrome with `--remote-debugging-port=9222` (dedicated profile).
2. Log in to FACEIT, enter matchmaking (CS2), click "Find Match".
3. When Accept appears, read the `matchId` `1-...` from the network.
4. Call `GET /data/v4/matches/1-...` — expect `200` with `teams.faction1/faction2.roster` (5+5 players).
5. Cross-check SteamID: `game_player_id` corresponds to SteamID64.
