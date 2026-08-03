#!/usr/bin/env bash
# Start Chrome with remote debugging enabled on port 9222.
# Uses a separate user profile to avoid interfering with your main Chrome.
#
# Usage: ./scripts/start-chrome.sh

set -euo pipefail

PROFILE_DIR="$HOME/.faceit-investigator-chrome"
DEBUG_PORT=9222

echo "Starting Chrome with remote debugging on port $DEBUG_PORT"
echo "Profile directory: $PROFILE_DIR"
echo ""

# macOS
if [[ "$(uname)" == "Darwin" ]]; then
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port="$DEBUG_PORT" \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run \
    --no-default-browser-check &
fi

# Linux
if [[ "$(uname)" == "Linux" ]]; then
  google-chrome \
    --remote-debugging-port="$DEBUG_PORT" \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run \
    --no-default-browser-check &
fi

echo ""
echo "Chrome started. Now:"
echo "  1. Navigate to https://www.faceit.com and log in"
echo "  2. Run: npm run start"
echo "  3. Start matchmaking"
echo "  4. Use the CLI markers to tag key moments"
echo "  5. Type 'stop' or press [7] to end capture"
echo ""
