# FACEIT Pre-Match Scout

Chrome extension (Manifest V3) that reveals FACEIT match rosters **before** clicking Accept — via the official FACEIT Data API.

Also includes the original CDP-based network investigator used during the research phase.

---

## Chrome Extension (MVP)

### What it does

```
FACEIT ready-check -> detect matchId -> FACEIT Data API -> full 5+5 roster -> overlay on page before Accept
```

### Manual test

1. Install dependencies:
   ```bash
   cd packages/core && npm install && cd ../..
   cd extension && npm install && cd ..
   ```
2. Run core tests:
   ```bash
   cd packages/core && npm test && cd ../..
   ```
3. Build the extension:
   ```bash
   cd extension && npm run build && cd ..
   ```
4. Open `chrome://extensions`
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked**
7. Select `extension/dist`
8. Click the extension icon -> **Open Options**
9. Enter your FACEIT Data API key (from https://developers.faceit.com)
10. Click **Test key**
11. Open https://www.faceit.com and start FACEIT Anti-Cheat
12. Enter CS2 matchmaking -> click **Find Match**
13. When the Accept button appears, wait a moment
14. The overlay should show both team rosters
15. Click Accept before the timer expires

### Project structure

```
packages/core/         Shared TypeScript logic
├── match-id.ts        matchId extraction with 1- prefix regex
├── faceit-client.ts   FACEIT Data API client
├── roster.ts          Roster parsing (teams.faction1/faction2)
├── types.ts           FaceitPlayer, MatchScoutState
└── *.test.ts          32 unit tests (Node test runner)

extension/             Chrome Extension (Manifest V3)
├── src/
│   ├── background/    Service worker: webRequest listener, API calls, state machine
│   ├── content/       Content script: React overlay in Shadow DOM
│   ├── popup/         Extension popup: status, clear match, open options
│   ├── options/       Options page: API key, display toggles, test key
│   └── shared/        Message types, ScoutOptions
├── public/
│   ├── manifest.json  MV3 manifest
│   ├── popup.html
│   └── options.html
├── build.mjs          esbuild bundler
└── dist/              Built extension (load this in Chrome)
```

### Key design decisions

- **Shadow DOM** for overlay isolation (no CSS conflicts with FACEIT)
- **chrome.webRequest.onBeforeRequest** for matchId detection (no debugger, no cookies, no blocking)
- **chrome.storage.local** for API key (never sent to content script)
- **Bounded retries** (0ms, 500ms, 1500ms) — no infinite polling
- **No Leetify** integration in this MVP

### MatchScoutState machine

```
idle -> match-detected -> loading -> ready
                               \-> partial
                               \-> error
```

---

## CDP Investigator (research tool)

The original tool that proved CASE_A: roster is available via Data API before Accept.

### Quick start

```bash
npm install
./scripts/start-chrome.sh          # or .ps1 on Windows
npm run start
```

Queue for a match and use CLI markers at each stage:
- `[1]` Queue started
- `[2]` Match found
- `[3]` Ready check visible
- `[4]` Accepted
- `[5]` Opponents revealed
- `[6]` Match room loaded
- `/` or `stop` — Stop and generate report

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run start` | Start live capture |
| `npm run analyze` | Re-analyze saved session |
| `npm test` | Run unit tests |
| `npm run typecheck` | TypeScript type checking |

### Requirements

- Node.js 20+
- Google Chrome (stable)
- Windows, macOS, or Linux

