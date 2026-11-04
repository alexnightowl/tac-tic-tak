#!/usr/bin/env bash
# Storm suite: seed a LOCAL throwaway user with three friends and runs
# (16-storm-seed.mjs), run 16-storm.yaml as that user, then check the run
# landed in the DB. Screenshots go to docs/mobile/screens/storm/ at 50 %.
#
#   apps/mobile/.maestro/16-storm.sh [--device UDID] [--lang en|uk]
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
export API=${API:-http://localhost:4000/api}
DEVICE=()
LANG_TAG=en
while [[ "${1:-}" == --* ]]; do
  case $1 in
    --device) DEVICE=(--device "$2"); shift 2 ;;
    --lang) LANG_TAG=$2; shift 2 ;;
    *) echo "unknown flag $1" >&2; exit 2 ;;
  esac
done

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }

eval "$(node 16-storm-seed.mjs "$E2E_PASSWORD" "$LANG_TAG")"
echo "── seeded: me=$ME"
OUT=$(mktemp -d)
fail=0
if maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$ME" -e E2E_PASSWORD="$E2E_PASSWORD" \
     -e SHOTS="shots" -e LANG="$LANG_TAG" 16-storm.yaml; then
  got=$(psql "select count(*)||' '||max(score) from \"StormRun\" where \"userId\"='$ME_ID'")
  read -r n best <<<"$got"
  if [[ $n -eq 2 && $best -eq 6 ]]; then echo "   DB ok: runs=$n best=$best"
  else echo "   DB MISMATCH: runs=$n best=$best"; fail=1; fi
else
  echo "   FLOW FAILED"; fail=1
fi
SHOT_DIR="$ROOT/docs/mobile/screens/storm"
mkdir -p "$SHOT_DIR"
while IFS= read -r f; do
  magick "$f" -resize 50% "$SHOT_DIR/$(basename "$f")"
done < <(find "$OUT" -path "*/shots/*" -name "*.png")
echo "screenshots: $SHOT_DIR"
exit $fail
