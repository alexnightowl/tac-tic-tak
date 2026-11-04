#!/usr/bin/env bash
# League suite: seed a LOCAL user (18-league-seed.mjs), run 18-league.yaml as
# that user. Screenshots go to docs/mobile/screens/league/.
#
#   apps/mobile/.maestro/18-league.sh [--device UDID] [--lang en|uk]
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
DEVICE=()
LANG_TAG=en
while [[ "${1:-}" == --* ]]; do
  case $1 in
    --device) DEVICE=(--device "$2"); shift 2 ;;
    --lang) LANG_TAG=$2; shift 2 ;;
    *) echo "unknown flag $1" >&2; exit 2 ;;
  esac
done
eval "$(node 18-league-seed.mjs "$LANG_TAG")"
OUT=$(mktemp -d)
fail=0
maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$ME" -e E2E_PASSWORD="$PW" -e SHOTS="shots" -e LANG="$LANG_TAG" 18-league.yaml || fail=1
SHOT_DIR="$ROOT/docs/mobile/screens/league"
mkdir -p "$SHOT_DIR"
while IFS= read -r f; do
  magick "$f" -resize 50% "$SHOT_DIR/$(basename "$f")"
done < <(find "$OUT" -path "*/shots/*" -name "*.png")
echo "screenshots: $SHOT_DIR"
exit $fail
