#!/usr/bin/env bash
# Challenge suite: seed two LOCAL throwaway users (17-challenge-seed.mjs:
# ME and a friend, an incoming challenge, a finished Race and a sent one),
# run 17-challenge.yaml as ME, then check the declined row in the DB.
#
#   apps/mobile/.maestro/17-challenge.sh [--device UDID] [--lang en|uk]
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

eval "$(node 17-challenge-seed.mjs "$E2E_PASSWORD" "$LANG_TAG")"
echo "── seeded: me=$ME friend=$FRIEND incoming=$INCOMING result=$RESULT waiting=$WAITING"
OUT=$(mktemp -d)
fail=0
if maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$ME" -e E2E_PASSWORD="$E2E_PASSWORD" \
     -e FRIEND="$FRIEND" -e INCOMING="$INCOMING" -e RESULT="$RESULT" -e WAITING="$WAITING" \
     -e SHOTS="shots" -e LANG="$LANG_TAG" 17-challenge.yaml; then
  st=$(psql "select status from \"Challenge\" where id = '$INCOMING'")
  if [[ $st == declined ]]; then echo "   DB ok: incoming challenge declined"
  else echo "   DB MISMATCH: incoming challenge status=$st"; fail=1; fi
else
  echo "   FLOW FAILED"; fail=1
fi
SHOT_DIR=$(mktemp -d)
find "$OUT" -path "*/shots/*" -name "*.png" -exec cp {} "$SHOT_DIR/" \;
echo "screenshots: $SHOT_DIR"
exit $fail
