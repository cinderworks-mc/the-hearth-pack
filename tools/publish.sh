#!/usr/bin/env bash
# DRAFT - not wired up yet, review before first use.
#
# publish one released version of the hearth client pack to this repo + github
# releases. run it AFTER the release is built and live, with the source checkout
# sitting at exactly the released state (clean tree, PACK_VERSION matching
# <version>). the changelog is hand-maintained in this repo: update CHANGELOG.md
# before running.
#
# usage: HEARTH_SRC=/path/to/client-pack tools/publish.sh <version>
set -euo pipefail

v="${1:?usage: HEARTH_SRC=/path/to/client-pack tools/publish.sh <version>}"
src="${HEARTH_SRC:?point HEARTH_SRC at the client-pack source dir}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

mrpack="$src/hearth-client-26.2-$v.mrpack"
[ -f "$mrpack" ] || { echo "missing $mrpack" >&2; exit 1; }

# copy the released pack source in
rsync -a --delete "$src/overrides/" "$repo_root/overrides/"
cp "$src/build_mrpack.py" "$src/make_servers_dat.py" "$src/hearth-icon.png" "$repo_root/"

cd "$repo_root"
git add -A
git commit -m "$v"
git tag "$v"
git push origin main "$v"
gh release create "$v" "$mrpack" \
  --repo cinderworks-mc/the-hearth-pack \
  --title "$v" \
  --notes "changes in CHANGELOG.md. import the .mrpack with the modrinth app."

# NOTE (09-03-2026): these repos are forgejo-mirrored on github, so github's git
# is read-only and `gh release create <tag>` cannot create the tag - it lands the
# release as a DRAFT. correct order: push the tag to forgejo FIRST, let it mirror,
# THEN gh release create; or publish the draft after with:
#   gh release edit <v> -R cinderworks-mc/the-hearth-pack --draft=false
