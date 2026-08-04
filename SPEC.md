# FACEIT Data API — wykrywanie graczy przed Accept — pełne szczegóły implementacyjne

Ten dokument to kompletna specyfikacja dla agenta AI, który ma zbudować rozszerzenie Chrome **lub** aplikację desktopową do pozyskiwania składów graczy FACEIT przed zaakceptowaniem meczu.

---

## 1. Werdykt / konkluzja badania

**CASE_A — YES.** Znając `matchId` (pełne, z prefiksem `1-`) przed kliknięciem Accept, można pobrać **pełny skład obu drużyn (10 graczy)** przez **oficjalne, publiczne FACEIT Data API**:

```
GET https://open.faceit.com/data/v4/matches/{matchId}
Authorization: Bearer <FACEIT_API_KEY>
Accept: application/json
```

- Zwraca `HTTP 200` z pełnym rosterem nawet w fazie `status: "CHECK_IN"` (przed pełnym startem meczu).
- Każdy gracz: `nickname`, `player_id`, `game_player_id` (= **SteamID64**), `game_skill_level`, `anticheat_required`, `membership`.
- **Nie wymaga** obchodzenia zabezpieczeń, współdzielenia sesji ani niewykorzystanych endpointów.

---

## 2. Krytyczne wymagania techniczne (uczone z realnego testu)

1. **Prefiks `1-` jest obowiązkowy.** Data API zwraca `404` dla gołego UUID:
   - `1-0ce0d100-d493-484d-9a91-332a1c865942` → `200` ✅
   - `0ce0d100-d493-484d-9a91-332a1c865942` → `404` ❌

2. **Anti-false-positive matchId.** W ruchu FACEIT jest dużo gołych UUID, które NIE są matchId, np. `community_id` z endpointu `searchCommunityLobbies?community_id=7dbcab58-...`. **Nie wolno** tych traktować jako matchId. Prawidłowy matchId to UUID z prefiksem `<liczba>-`:

```regex
^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
```

3. **Gdzie znaleźć matchId w żywym ruchu:** URL wewnętrznego endpointu wysyłanego przez stronę (nie trzeba nic przepisywać):

```
https://www.faceit.com/api/match/v4/match/1-<matchId>
https://www.faceit.com/api/match/v1/checkin/1-<matchId>
```

Te zapytania pojawiają się, gdy match jest znaleziony i widnieje Accept.

4. **Regeneracja sesji**: w payloadzie wewnętrznym może występować też gołe id (`0ce0d100...`) w polu `payload.id` — do Data API używasz **zawsze** wersji z prefiksem.

---

## 3. Dane dostępne z Data API (struktura JSON)

Odpowiedź `200` zawiera m.in.:

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
        // ... 5 graczy
      ],
      "stats": {
        "winProbability": 0.5,
        "skillLevel": { "average": 10 },
        "rating": 2672
      }
    },
    "faction2": { /* analogicznie, 5 graczy */ }
  }
}
```

**Mapowanie pól na identyfikatory:**

| Co | Pole w Data API |
|----|-----------------|
| Nickname | `teams.factionN.roster[].nickname` |
| FACEIT Player ID | `teams.factionN.roster[].player_id` |
| **SteamID64** | `teams.factionN.roster[].game_player_id` |
| Nazwa Steam | `teams.factionN.roster[].game_player_name` |
| Poziom / skill | `teams.factionN.roster[].game_skill_level` |
| Drużyna | `teams.faction1` / `teams.faction2` (oraz `name` w nim) |

Uwaga: `game_player_id` to **SteamID64** — nie mylić z `player_id` (FACEIT-owe id). W wewnętrznym (nieoficjalnym) API pole nazywałoby się `steam_id_64`, ale w oficjalnym Data API jest to `game_player_id`.

---

## 4. Klucz `FACEIT_API_KEY`

- Klucz developerski z <https://developers.faceit.com>.
- Przekazywany wyłącznie w nagłówku `Authorization: Bearer <KEY>`.
- **Nigdy nie logować / nie persystować** wartości klucza. Obsługiwać: `401`/`403` → błąd klucza (komunikat „sprawdź klucz”), `429` → rate-limit (backoff), `404` → match niepubliczny, timeout.
- Zalecany timeout np. 8–10 s.

---

## 5. Rekomendacja: rozszerzenie Chrome vs aplikacja desktopowa

**Rekomendacja: Rozszerzenie Chrome** (Manifest V3), bo:
- Musi wykryć matchId z ruchu strony **na platformie FACEIT w przeglądarce** — rozszerzenie ma naturalny dostęp (webRequest / declarativeNetRequest / monitoring DOM).
- Nie narusza żadnych praw (endpoint publiczny).
- Najszybsza dystrybucja i prostota.
- Data API wymaga jedynie klucza, trzymany w `chrome.storage.local`.

Możliwa hybryda: **rozszerzenie Chrome + opcjonalny lokalny sygnalizator** (notyfikacja / alert dźwiękowy). Aplikacja desktopowa nie jest konieczna.

**Kiedy desktop miałby sens:** gdybyśmy chcieli dodatkowe integracje poza przeglądarką (niepotrzebne tutaj).

> Decyzja: **Chrome Extension (Manifest V3)** jako MVP.

---

## 6. Proponowana architektura rozszerzenia Chrome (MV3)

```
manifest.json (MV3)
├─ permissions: ["storage","alarms","notifications","webRequest"] + host_permissions:
│    https://www.faceit.com/* , https://open.faceit.com/*
├─ background service worker (detekcja matchId, wywołanie Data API, alarm)
├─ content script (opcjonalnie: obserwacja DOM pod kątem matchId / przycisku Accept)
└─ popup (status + lista wczytanych graczy)
```

**Flow:**

1. Background nasłuchuje żądań sieciowych do `www.faceit.com/api/match/v4/match/*` lub `*/checkin/*`.
2. Wyciąga `1-<uuid>` z URL (regex z sekcji 2).
3. Trzyma ostatni wykryty matchId w `chrome.storage.local`.
4. Natychmiast po wykryciu wywołuje `open.faceit.com/data/v4/matches/<matchId>` z kluczem.
5. Parsuje `teams.faction1/faction2.roster`, zapisuje do storage, pokazuje w popup + notyfikacja.
6. Powtarza co ~1–2 s (alarm) do momentu zmiany `status`, by zawsze mieć najświeższy skład.

Przycisk „Accept” mechanicznie zostaje po stronie użytkownika — rozszerzenie tylko **czyta** publiczne API.

---

## 7. Obsługa błędów / edge-case

- **401/403** → nieprawidłowy klucz; popup prosi o sprawdzenie `FACEIT_API_KEY`.
- **404** → match nie jest (jeszcze) publiczny; retry z backoffem (np. 500 ms → 1,5 s → stop), albo zbyt wcześnie.
- **429** → rate-limit; czekaj zgodnie z `Retry-After`, nie spamuj.
- **Timeout/network** → ponów, nie zawieszaj UI.
- **Zmiana `status` z `CHECK_IN` na `VOTING`/`CONFIGURING`** → skład pełny; przestań odpytywać częściej.
- **Brak prefiksu** w znalezionym id → zignoruj (to nie matchId, np. `community_id`).

---

## 8. Struktura projektu (repo `fve`, TypeScript)

Kluczowe moduły już istniejące (można przenieść logikę do rozszerzenia):

- `src/analysis/match-id.ts` — `extractMatchId`, `detectMatchId`, regex `MATCH_ID_WITH_PREFIX`, wykluczanie gołych UUID.
- `src/faceit/data-api-client.ts` — `fetchMatchData` (timeout, auth, sanityzacja), `classifyDataApiResult` (200/404/401/403/429).
- `src/analysis/roster.ts` — ekstrakcja graczy: `nickname`, `player_id`, `game_player_id` → `steamId64`, team, JSON path; odrzuca `rosterWithSubstitutes:false`.
- `src/analysis/diff.ts` — porównanie pre/post accept.
- Testy: 51 jednostkowych (Node `node:test`).

### Przetestowane realnie (fixture) — skład z Data API przed Accept

- Team 1 (GR1NA): `GR1NA` (`76561198249664530`), `siNCo-` (`76561198119694078`), `-AthE` (`76561198838634986`), `-T0KI` (`76561198838474668`), `Ceo---` (`76561198362845213`)
- Team 2: `108-` (`76561198782132866`), `shorstky` (`76561198070756713`), `tumi` (`76561198035293177`), `shadyb` (`76561198080436813`), `AHLIN-` (`76561198108255427`)

---

## 9. Test / procedura weryfikacji dla nowego agenta

1. Włącz Chrome z `--remote-debugging-port=9222` (dedykowany profil).
2. Zaloguj się na FACEIT, wejdź w matchmaking (CS2), wciśnij „Find Match”.
3. Gdy pojawi się Accept, odczytaj `matchId` `1-...` z sieci.
4. Wywołaj `GET /data/v4/matches/1-...` — oczekuj `200` z `teams.faction1/faction2.roster` (5+5 graczy).
5. Cross-check SteamID: `game_player_id` odpowiada SteamID64.
