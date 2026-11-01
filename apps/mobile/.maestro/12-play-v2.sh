#!/usr/bin/env bash
# Play v2 suite: for each case, register a LOCAL throwaway user, seed its
# bullet progression with psql, run 12-play-v2.yaml, then check the DB.
# Screenshots land in docs/mobile/screens/play-v2/<lang>/.
#
#   apps/mobile/.maestro/12-play-v2.sh [--device UDID] [--lang en|uk] [case …]
#   cases: levelup guard down casual early
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
API=${API:-http://localhost:4000/api}
DEVICE=()
LANG_TAG=en
while [[ "${1:-}" == --* ]]; do
  case $1 in
    --device) DEVICE=(--device "$2"); shift 2 ;;
    --lang) LANG_TAG=$2; shift 2 ;;
    *) echo "unknown flag $1" >&2; exit 2 ;;
  esac
done
CASES=("$@")
[[ ${#CASES[@]} -eq 0 ]] && CASES=(levelup guard down casual early)

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }
puzzles() { psql "select string_agg(id, ',') from (select id from \"Puzzle\" where rating between $1 and $2 order by random() limit $3) p"; }
SHOT_DIR="$ROOT/docs/mobile/screens/play-v2/$LANG_TAG"
mkdir -p "$SHOT_DIR"

fail=0
for c in "${CASES[@]}"; do
  nick="v2${c:0:3}$(date +%s)"
  curl -sf -X POST "$API/auth/register" -H 'content-type: application/json' \
    -d "{\"nickname\":\"$nick\",\"password\":\"$E2E_PASSWORD\",\"repeatPassword\":\"$E2E_PASSWORD\"}" >/dev/null
  uid=$(psql "select id from \"User\" where nickname = '$nick'")
  for s in bullet blitz rapid; do
    psql "insert into \"UserStyleProgression\" (\"userId\", style, \"updatedAt\") values ('$uid', '$s', now()) on conflict do nothing" >/dev/null
  done
  psql "update \"UserSetting\" set language='$LANG_TAG', \"onboardingCompleted\"=true where \"userId\"='$uid'" >/dev/null
  # seed <rating> <level> <guard>
  seed() {
    psql "update \"UserStyleProgression\" set \"calibrationSessionsLeft\"=0, \"currentPuzzleRating\"=$1,
          \"startPuzzleRating\"=$1, \"unlockedStartRating\"=$2, level=$2, \"levelGuard\"=$3, \"updatedAt\"=now()
          where \"userId\"='$uid'" >/dev/null
  }
  P=""; CORRECT=true
  case $c in
    levelup) seed 1490 1450 0; P=$(puzzles 1650 1750 8) ;;
    guard)   seed 1510 1500 0; P=$(puzzles 1150 1250 12); CORRECT=false ;;
    down)    seed 1510 1500 1; P=$(puzzles 1150 1250 12); CORRECT=false ;;
    casual)  seed 1510 1500 0 ;;
    early)   seed 1510 1500 0 ;;
    *) echo "unknown case $c" >&2; exit 2 ;;
  esac
  level=$(psql "select level from \"UserStyleProgression\" where \"userId\"='$uid' and style='bullet'")
  rating=$(psql "select \"currentPuzzleRating\" from \"UserStyleProgression\" where \"userId\"='$uid' and style='bullet'")
  push=$((rating + 200))
  OUT=$(mktemp -d)
  echo "── $c ($nick)"
  if maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$nick" -e E2E_PASSWORD="$E2E_PASSWORD" \
       -e CASE="$c" -e API="$API" -e PUZZLES="$P" -e CORRECT="$CORRECT" -e LEVEL="$level" -e PUSH="$push" \
       -e SHOTS="shots" 12-play-v2.yaml; then
    find "$OUT" -path "*/shots/*" -name "*.png" -exec cp {} "$SHOT_DIR/" \;
    got=$(psql "select \"currentPuzzleRating\"||' '||level||' '||\"levelGuard\" from \"UserStyleProgression\" where \"userId\"='$uid' and style='bullet'")
    read -r r l g <<<"$got"
    ok=0
    case $c in
      levelup) [[ $l -gt 1450 && $l -eq $(( r / 50 * 50 )) ]] && ok=1 ;;
      guard)   [[ $l -eq 1500 && $g -eq 1 && $r -lt 1450 ]] && ok=1 ;;
      down)    [[ $l -lt 1500 && $g -eq 0 ]] && ok=1 ;;
      casual)  [[ $r -eq 1510 && $l -eq 1500 ]] && ok=1 ;;
      early)   [[ $l -eq 1500 ]] && ok=1 ;;
    esac
    xp=$(psql "select xp from \"UserExperience\" where \"userId\"='$uid'")
    if [[ $ok -eq 1 ]]; then echo "   DB ok: rating/level/guard = $got, xp = ${xp:-0}"
    else echo "   DB MISMATCH: rating/level/guard = $got"; fail=1; fi
  else
    echo "   FLOW FAILED: $c"; fail=1
  fi
done
exit $fail
