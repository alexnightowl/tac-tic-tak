#!/usr/bin/env bash
# Library suite: for each case, register a LOCAL throwaway user, seed it
# with psql, run 13-library.yaml, then check LibraryAttempt / ReviewItem.
# Screenshots land in docs/mobile/screens/library/<lang>/.
#
#   apps/mobile/.maestro/13-library.sh [--device UDID] [--lang en|uk] [case …]
#   cases: read cycle2   (BOOK=greco|romantic, default greco)
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
API=${API:-http://localhost:4000/api}
BOOK=${BOOK:-greco}
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
[[ ${#CASES[@]} -eq 0 ]] && CASES=(read cycle2)

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }
SHOT_DIR="$ROOT/docs/mobile/screens/library/$LANG_TAG"
# Puzzles in chapter I (ids lib-<book>-1-NN).
CH1=$(psql "select count(*) from \"Puzzle\" where id like 'lib-$BOOK-1-%'")
mkdir -p "$SHOT_DIR"

fail=0
for c in "${CASES[@]}"; do
  nick="lb${c:0:3}$(date +%s)"
  curl -sf -X POST "$API/auth/register" -H 'content-type: application/json' \
    -d "{\"nickname\":\"$nick\",\"password\":\"$E2E_PASSWORD\",\"repeatPassword\":\"$E2E_PASSWORD\"}" >/dev/null
  uid=$(psql "select id from \"User\" where nickname = '$nick'")
  psql "update \"UserSetting\" set language='$LANG_TAG', \"onboardingCompleted\"=true where \"userId\"='$uid'" >/dev/null
  CYCLE=1
  if [[ $c == cycle2 ]]; then
    CYCLE=2
    # Cycle 1 of the first chapter, 48 s a puzzle, 3 misses, a week ago.
    psql "insert into \"LibraryAttempt\" (id, \"clientId\", \"userId\", \"bookId\", \"puzzleId\", cycle, result, \"timeMs\", \"solvedAt\")
          select gen_random_uuid()::text, gen_random_uuid()::text, '$uid', '$BOOK', id, 1,
                 case when row_number() over (order by id) % 7 = 0 then 'missed' else 'clean' end,
                 30000 + (row_number() over (order by id) % 5) * 9000, now() - interval '7 days'
          from \"Puzzle\" where id like 'lib-$BOOK-%'" >/dev/null
  fi
  OUT=$(mktemp -d)
  echo "── $c ($nick)"
  if maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$nick" -e E2E_PASSWORD="$E2E_PASSWORD" \
       -e CASE="$c" -e CYCLE="$CYCLE" -e BOOK="$BOOK" -e CH1="$CH1" -e SHOTS="shots" 13-library.yaml; then
    find "$OUT" -path "*/shots/*" -name "*.png" -exec cp {} "$SHOT_DIR/" \;
    got=$(psql "select count(*)||' '||count(*) filter (where result<>'clean') from \"LibraryAttempt\" where \"userId\"='$uid' and cycle=$CYCLE")
    review=$(psql "select count(*) from \"ReviewItem\" where \"userId\"='$uid' and \"puzzleId\" like 'lib-%' and \"resolvedAt\" is null")
    read -r n bad <<<"$got"
    ok=0
    case $c in
      read)   [[ $n -eq $CH1 && $bad -eq 3 && $review -eq 3 ]] && ok=1 ;;
      cycle2) [[ $n -eq $CH1 && $bad -eq 0 ]] && ok=1 ;;
    esac
    if [[ $ok -eq 1 ]]; then echo "   DB ok: cycle $CYCLE results=$n not-clean=$bad review=$review"
    else echo "   DB MISMATCH: cycle $CYCLE results=$n not-clean=$bad review=$review"; fail=1; fi
  else
    echo "   FLOW FAILED: $c"; fail=1
  fi
done
exit $fail
