#!/usr/bin/env bash
# Regenerates everything in apps/mobile/assets from apps/frontend sources.
# Order matters only for the manifest, which indexes the others' output.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
node "$root/tools/assets/build-images.mjs"
bash "$root/tools/assets/fonts.sh"
node "$root/tools/audio/process-sfx.mjs"
node "$root/tools/audio/render-synth.mjs"
node "$root/tools/assets/build-manifest.mjs"
