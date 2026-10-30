#!/usr/bin/env bash
# Recalibration from a replayed onboarding: registers a LOCAL throwaway
# user (e2e_recal_*), marks every style calibrated at norm 1500, runs
# 09-recalibrate.yaml, then checks every style is back to 5 calibration
# sessions with the norm untouched. Local backend + docker Postgres only.
#
#   apps/mobile/.maestro/09-recalibrate.sh [--device UDID] [lang]
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd ../../.. && pwd)
set -a; . ./.env.e2e; set +a
API=${API:-http://localhost:4000/api}
DEVICE=()
if [[ "${1:-}" == "--device" ]]; then DEVICE=(--device "$2"); shift 2; fi
LANG_TAG=${1:-en}

psql() { (cd "$ROOT" && docker compose exec -T postgres psql -U taktic -d taktic -tAc "$1"); }
nick="e2e_recal_$(date +%s)"
curl -sf -X POST "$API/auth/register" -H 'content-type: application/json' \
  -d "{\"nickname\":\"$nick\",\"password\":\"$E2E_PASSWORD\",\"repeatPassword\":\"$E2E_PASSWORD\"}" >/dev/null
uid=$(psql "select id from \"User\" where nickname = '$nick'")
for s in bullet blitz rapid; do
  psql "insert into \"UserStyleProgression\" (\"userId\", style, \"updatedAt\") values ('$uid', '$s', now()) on conflict do nothing" >/dev/null
done
psql "update \"UserSetting\" set language='$LANG_TAG' where \"userId\"='$uid'" >/dev/null
psql "update \"UserStyleProgression\" set \"calibrationSessionsLeft\"=0, \"unlockedStartRating\"=1500,
      \"weakSessionStreak\"=1, \"updatedAt\"=now() where \"userId\"='$uid'" >/dev/null

OUT=$(mktemp -d)
maestro "${DEVICE[@]}" test --test-output-dir "$OUT" -e RECAL_USER="$nick" -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e SHOT="onboarding-recalibrate-$LANG_TAG" 09-recalibrate.yaml
mkdir -p "$ROOT/docs/mobile/screens/recalibrate"
find "$OUT" -name "onboarding-recalibrate-$LANG_TAG.png" -exec cp {} "$ROOT/docs/mobile/screens/recalibrate/" \;

got=$(psql "select string_agg(style||':'||\"calibrationSessionsLeft\"||':'||\"unlockedStartRating\"||':'||\"weakSessionStreak\", ' ' order by style) from \"UserStyleProgression\" where \"userId\"='$uid'")
want="blitz:5:1500:0 bullet:5:1500:0 rapid:5:1500:0"
echo "db: $got"
[[ "$got" == "$want" ]] || { echo "FAIL: want $want" >&2; exit 1; }
echo PASS
