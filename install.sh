#!/usr/bin/env bash
# One-time setup for a fresh clone. Builds bible.db from the committed intermediates in
# build/data/sources/ (no sources/ tree needed), then installs the app's dependencies.
# When it finishes, run ./start.sh to launch DeepVerse.
set -euo pipefail
cd "$(dirname "$0")"

# The build uses node:sqlite, which needs Node >= 22.
major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -lt 22 ]; then
  echo "DeepVerse needs Node >= 22 (found $(node -v 2>/dev/null || echo none)). Install a newer Node and retry." >&2
  exit 1
fi

echo "Building bible.db from vendored intermediates…"
( cd build && node build-db.mjs && node validate-db.mjs )

echo "Installing app dependencies…"
( cd app && npm install )

echo
echo "Setup complete. Run ./start.sh to launch DeepVerse → http://localhost:5173"
