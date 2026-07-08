#!/usr/bin/env bash
# Start DeepVerse — the study-bible app.
# Launches the Vite dev server and opens it in your browser. Run from anywhere:  ./start.sh
set -euo pipefail

cd "$(dirname "$0")/app"

if [ ! -d node_modules ]; then
  echo "First run — installing dependencies…"
  npm install
fi

echo "Starting DeepVerse → http://localhost:5173 (Ctrl-C to stop)"
exec npm run dev -- --open
