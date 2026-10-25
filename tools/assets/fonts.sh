#!/usr/bin/env bash
# Runs fonts.py with fontTools. Uses the system python if it already has it,
# otherwise a throwaway venv in $TMPDIR (pinned fontTools, reused across runs).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if python3 -c 'import fontTools' 2>/dev/null; then
  exec python3 "$here/fonts.py"
fi
venv="${TMPDIR:-/tmp}/tac-fonttools-venv"
if [ ! -x "$venv/bin/python" ] || ! "$venv/bin/python" -c 'import fontTools' 2>/dev/null; then
  python3 -m venv "$venv"
  "$venv/bin/pip" install --quiet 'fonttools==4.60.1'
fi
exec "$venv/bin/python" "$here/fonts.py"
