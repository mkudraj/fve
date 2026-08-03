# FACEIT Pre-Match Lobby Network Investigator

Captures and analyzes FACEIT matchmaking network traffic via Chrome DevTools Protocol to determine whether match data (match_id, roster, map, server) arrives in the browser before the official UI reveal.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start Chrome with remote debugging enabled
./scripts/start-chrome.sh

# 3. Navigate to https://www.faceit.com and log in

# 4. Start the investigator
npm run start

# 5. Queue for a match and use CLI markers at each stage:
#    [1] Queue started
#    [2] Match found
#    [3] Ready check visible
#    [4] Accepted
#    [5] Opponents officially revealed
#    [6] Match room loaded
#    [7] / "stop" — Stop capture and generate report
```

## How it works

1. Connects to Chrome via CDP on port 9222
2. Finds the active FACEIT tab
3. Captures all Fetch/XHR requests and responses (including bodies)
4. Captures all WebSocket frames (sent + received)
5. Searches captured data for match-related terms (match_id, roster, map, server, etc.)
6. Classifies findings as pre-reveal or post-reveal based on manual time markers
7. Generates a Markdown + JSON report with findings and a CASE_A/B/C recommendation

## Output

Reports are saved in `output/session-<id>/`:

| File | Description |
|------|-------------|
| `report.md` | Human-readable findings and recommendations |
| `report.json` | Full session data with markers, hits, and findings |
| `timeline.json` | Chronological timeline of all events |
| `matches.json` | All extracted match hits |

## Re-analyzing a session

```bash
# Analyze the latest session
npm run analyze

# Analyze a specific session
npm run analyze output/session-<id>
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run start` | Start live capture |
| `npm run analyze` | Re-analyze saved session data |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run unit tests |

## Requirements

- Node.js 20+
- Google Chrome (stable)
- macOS or Linux
