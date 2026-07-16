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

# Verify the git-LFS text-to-speech models actually came down. Without git-lfs, a clone leaves
# ~133-byte pointer files in their place and audio (Greek/Hebrew pronunciation) fails to load.
# If git-lfs is available in a git checkout, fetch them automatically; otherwise fall back to a
# note. Non-fatal either way: everything except audio works regardless.
check_tts() {
  tts_ok=1
  for m in app/public/tts/mms-heb.onnx app/public/tts/mms-ell.onnx; do
    if [ ! -f "$m" ] || head -c 64 "$m" | grep -q "git-lfs.github.com"; then tts_ok=0; fi
  done
}
check_tts
if [ "$tts_ok" -ne 1 ] && git lfs version >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Fetching text-to-speech models via git-LFS…"
  git lfs install --local >/dev/null 2>&1 || true
  git lfs pull || true
  check_tts
  [ "$tts_ok" -eq 1 ] && echo "  text-to-speech models fetched."
fi
if [ "$tts_ok" -ne 1 ]; then
  echo
  echo "Note: text-to-speech models aren't available, so audio (Greek/Hebrew pronunciation)" >&2
  echo "is disabled. Everything else works. To enable audio later:" >&2
  if git lfs version >/dev/null 2>&1; then
    echo "  git lfs pull" >&2
  else
    echo "  install git-lfs (e.g. 'brew install git-lfs'), then:  git lfs install && git lfs pull" >&2
  fi
fi

echo
echo "Setup complete. Run ./start.sh to launch DeepVerse → http://localhost:5173"
