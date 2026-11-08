#!/usr/bin/env bash
# Builds the web app and uploads it to the dev instance
# (https://tactictak.online:8443, static files served by the VPS nginx).
# Needs the prod ssh key (memory: prod-server); touches no container.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEY="${TACTICTAK_SSH_KEY:-$HOME/.ssh/id_ed25519_tactictak_prod}"
HOST=root@tactictak.online
# nginx mounts the parent folder, so swapping the child dir is picked up live.
DEST=/opt/tactictak-web/dev
OUT="$(mktemp -d)/dist-web"

"$ROOT/tools/web/export.sh" "$OUT"
SSH="ssh -o BatchMode=yes -o IdentitiesOnly=yes -i $KEY"
rsync -az --delete -e "$SSH" "$OUT/" "$HOST:$DEST.next/"
# Swap in one step so a visitor never gets a half-uploaded bundle.
$SSH "$HOST" "rm -rf $DEST.prev && { [ -d $DEST ] && mv $DEST $DEST.prev || true; } && mv $DEST.next $DEST"
echo "deployed to https://tactictak.online:8443"
