#!/usr/bin/env bash
# Start DeepVerse — the study-bible app.
# Launches the Vite dev server, then opens the installed PWA (falling back to
# your browser if it isn't installed). Run from anywhere:  ./start.sh
set -euo pipefail

cd "$(dirname "$0")/app"

if [ ! -d node_modules ]; then
  echo "First run — installing dependencies…"
  npm install
fi

url="http://localhost:5173/"

# Locate the installed DeepVerse PWA, if any (Chrome/Edge app shortcuts or a
# Safari "Add to Dock" app). Prints its path and returns 0 when found.
find_pwa() {
  local dir
  for dir in \
    "$HOME/Applications/Chrome Apps.localized" \
    "$HOME/Applications/Chrome Apps" \
    "$HOME/Applications/Edge Apps.localized" \
    "$HOME/Applications/Edge Apps" \
    "$HOME/Applications" \
    "/Applications"; do
    if [ -d "$dir/DeepVerse.app" ]; then
      printf '%s\n' "$dir/DeepVerse.app"
      return 0
    fi
  done
  return 1
}

# Wait for the dev server, then open the PWA — or the browser as a fallback.
open_app() {
  local pwa
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$url" && break
    sleep 0.5
  done
  if pwa="$(find_pwa)"; then
    echo "Opening DeepVerse PWA → $pwa"
    open "$pwa"
  else
    echo "PWA not installed — opening in your browser"
    open "$url"
  fi
}

echo "Starting DeepVerse → ${url} (Ctrl-C to stop)"
open_app &
exec npm run dev
