#!/usr/bin/env bash
# Courses suite: for each case, register a LOCAL throwaway user, seed it
# with psql, run 15-courses.yaml, then check LibraryAttempt / CourseExam.
#
#   apps/mobile/.maestro/15-courses.sh [--device UDID] [--lang en|uk] [case …]
#   cases: intro gate exam   (COURSE=basic by default)
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
API=${API:-http://localhost:4000/api}
COURSE=${COURSE:-basic}
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
[[ ${#CASES[@]} -eq 0 ]] && CASES=(intro gate exam)

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }
CONTENT="$ROOT/apps/backend/src/library/courses/$COURSE.json"
# Every chapter puzzle id (not the exam), as a SQL list.
IDS=$(python3 -I -c 'import json,sys; c=json.load(open(sys.argv[1])); print(",".join("'"'"'%s'"'"'" % p for ch in c["chapters"] for p in [x["id"] for x in ch["puzzles"]]))' "$CONTENT")
SHOT_DIR=$(mktemp -d)

fail=0
for c in "${CASES[@]}"; do
  nick="cs${c:0:3}$(date +%s)"
  curl -sf -X POST "$API/auth/register" -H 'content-type: application/json' \
    -d "{\"nickname\":\"$nick\",\"password\":\"$E2E_PASSWORD\",\"repeatPassword\":\"$E2E_PASSWORD\"}" >/dev/null
  uid=$(psql "select id from \"User\" where nickname = '$nick'")
  psql "update \"UserSetting\" set language='$LANG_TAG', \"onboardingCompleted\"=true where \"userId\"='$uid'" >/dev/null
  if [[ $c == exam ]]; then
    # Cycle 1: every chapter done, 40 s a puzzle, yesterday.
    psql "insert into \"LibraryAttempt\" (id, \"clientId\", \"userId\", \"bookId\", \"puzzleId\", cycle, result, \"timeMs\", \"solvedAt\")
          select gen_random_uuid()::text, gen_random_uuid()::text, '$uid', '$COURSE', id, 1, 'clean', 40000, now() - interval '1 day'
          from \"Puzzle\" where id in ($IDS)" >/dev/null
  fi
  OUT=$(mktemp -d)
  echo "── $c ($nick)"
  if maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e E2E_USER="$nick" -e E2E_PASSWORD="$E2E_PASSWORD" \
       -e CASE="$c" -e COURSE="$COURSE" -e SHOTS="shots" 15-courses.yaml; then
    find "$OUT" -path "*/shots/*" -name "*.png" -exec cp {} "$SHOT_DIR/" \;
    n=$(psql "select count(*) from \"LibraryAttempt\" where \"userId\"='$uid' and \"bookId\"='$COURSE' and \"solvedAt\" > now() - interval '1 hour'")
    ok=0
    case $c in
      intro) [[ $n -eq 1 ]] && ok=1 ;;
      gate)  [[ $n -eq 0 ]] && ok=1 ;;
      exam)  [[ $n -ge 1 ]] && ok=1 ;;
    esac
    if [[ $ok -eq 1 ]]; then echo "   DB ok: new course results=$n"
    else echo "   DB MISMATCH: new course results=$n"; fail=1; fi
  else
    echo "   FLOW FAILED: $c"; fail=1
  fi
done
echo "screenshots: $SHOT_DIR"
exit $fail
