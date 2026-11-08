#!/usr/bin/env bash
# Builds the web version of apps/mobile (react-native-web, D35) into a
# static folder: tools/web/export.sh [out-dir] (default apps/mobile/dist-web).
# EXPO_PUBLIC_API_URL picks the backend (default: the prod API).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/apps/mobile/dist-web}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://tactictak.online/api}"
# Tree shaking drops the unused lucide icons (~1.45 → ~1.19 MB gzipped JS).
export EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 EXPO_UNSTABLE_TREE_SHAKING=1

cd "$ROOT/apps/mobile"
rm -rf "$OUT"
npx expo export --platform web --output-dir "$OUT"

# The app ships most images as @2x/@3x only. Native picks a scale; the web
# bundle asks for the bare name, so give it the @2x file under that name.
find "$OUT/assets" -name '*@2x.*' | while read -r f; do
  base="${f/@2x/}"
  [ -f "$base" ] || cp "$f" "$base"
done
echo "web export: $OUT ($(du -sh "$OUT" | cut -f1)) → $EXPO_PUBLIC_API_URL"
