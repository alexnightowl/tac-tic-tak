#!/usr/bin/env bash
# Phase 5 outcome suite: for each case, seed the bullet progression of a
# LOCAL test user with psql, run 05-outcomes.yaml, then check the DB.
# Local backend + docker Postgres only; never point this at prod.
#
#   apps/mobile/.maestro/05-outcomes.sh [--device UDID] [case …]
#   cases: calibration unlock unlock-rank demote demote-rank comfort early
#
# Needs .maestro/.env.e2e (E2E_PASSWORD) and the user E2E_PLAY_USER
# (default e2e_play; create it with POST /api/auth/register).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
USER_NICK=${E2E_PLAY_USER:-e2e_play}
API=${API:-http://localhost:4000/api}
DEVICE=()
if [[ "${1:-}" == "--device" ]]; then DEVICE=(--device "$2"); shift 2; fi
CASES=("$@")
[[ ${#CASES[@]} -eq 0 ]] && CASES=(calibration unlock unlock-rank demote demote-rank comfort early)

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }
uid=$(psql "select id from \"User\" where nickname = '$USER_NICK'")
[[ -n "$uid" ]] || { echo "no local user $USER_NICK" >&2; exit 1; }

# seed <calibrationLeft> <norm> <start=current> <weakStreak>
seed() {
  psql "update \"UserStyleProgression\" set \"calibrationSessionsLeft\"=$1, \"unlockedStartRating\"=$2,
        \"startPuzzleRating\"=$3, \"currentPuzzleRating\"=$3, \"weakSessionStreak\"=$4, \"updatedAt\"=now()
        where \"userId\"='$uid' and style='bullet'" >/dev/null
}
prog() { psql "select \"unlockedStartRating\"||' '||\"calibrationSessionsLeft\"||' '||\"weakSessionStreak\" from \"UserStyleProgression\" where \"userId\"='$uid' and style='bullet'"; }
puzzles() { psql "select string_agg(id, ',') from (select id from \"Puzzle\" where rating between $1 and $2 order by random() limit 7) p"; }

fail=0
for c in "${CASES[@]}"; do
  P=""
  case $c in
    calibration) seed 1 1200 1200 0; want="1200 0 0" ;;
    unlock)      seed 0 1500 1500 0; P=$(puzzles 1620 1750); want="1550 0 0" ;;
    unlock-rank) seed 0 1350 1350 0; P=$(puzzles 1470 1600); want="1400 0 0" ;;
    demote)      seed 0 1500 1475 1; want="1475 0 0" ;;
    demote-rank) seed 0 1400 1375 1; want="1375 0 0" ;;
    comfort)     seed 0 1500 1500 0; want="1500 0 0" ;;
    early)       seed 0 1500 1500 0; want="1500 0 0" ;;
    *) echo "unknown case $c" >&2; exit 2 ;;
  esac
  echo "── $c"
  if maestro "${DEVICE[@]}" test -e E2E_USER="$USER_NICK" -e E2E_PASSWORD="$E2E_PASSWORD" -e CASE="$c" \
       -e API="$API" -e PUZZLES="$P" 05-outcomes.yaml; then
    got=$(prog)
    if [[ "$got" == "$want" ]]; then echo "   DB ok: norm/calibration/weak = $got"
    else echo "   DB MISMATCH: got '$got', want '$want'"; fail=1; fi
  else
    echo "   FLOW FAILED: $c"; fail=1
  fi
done
exit $fail
