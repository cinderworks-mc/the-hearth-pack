#!/usr/bin/env bash
# build the client pack download page and push it to the web host. run from anywhere.
#
#   ./site/deploy.sh          build + push
#   ./site/deploy.sh --build  build only, no push
#
# the push target is NOT in this repo (it is public). put it in site/deploy.env,
# which is gitignored:
#
#   HEARTHPACK_TARGET="user@host:/path/to/webroot/"
#   HEARTHPACK_LAN_IP="x.x.x.x"      # the web host, used for the post-push check
#
# the page is built from what is already in this repo - the newest .mrpack by
# version, build_mrpack.py, overrides/, README.md - so build_mrpack.py runs
# FIRST when the pack itself changed. this script never runs it: the pack build
# is the slow, network-bound half and it is deliberately its own step.
#
#   python3 build_mrpack.py
#   ./site/deploy.sh
#
# no --delete on the rsync. the html and css overwrite in place and downloads/
# stays additive, so a .mrpack link already pasted into discord keeps resolving
# after a version bump. each pack is ~20 KB, so prune only when it gets silly.
#
# preview.png is excluded - it is a build artefact for eyeballing the page, not
# something to serve.
#
# THIS IS ONE PART OF A VERSION BUMP. the discord status card, the github
# release and the modrinth version are separate steps.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO/site/deploy.env"

cd "$REPO"

node site/build_site.js

if [ "${1:-}" = "--build" ]; then
  echo "built only, not pushed"
  exit 0
fi

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${HEARTHPACK_TARGET:?set HEARTHPACK_TARGET in site/deploy.env (user@host:/path/)}"
: "${HEARTHPACK_LAN_IP:?set HEARTHPACK_LAN_IP in site/deploy.env}"

rsync -av --exclude preview.png site/build/ "$HEARTHPACK_TARGET"

echo
# the page lives at cinderworks.dev/hearth/pack/ since 08-31-2026. checked over
# the lan first (bypassing dns), then publicly.
echo "pushed. verifying:"
curl -s -k --resolve "cinderworks.dev:443:${HEARTHPACK_LAN_IP}" \
  https://cinderworks.dev/hearth/pack/ -o /dev/null -w "  page     %{http_code}\n"
curl -s https://cinderworks.dev/hearth/pack/ -o /dev/null -w "  public   %{http_code}\n" || true
