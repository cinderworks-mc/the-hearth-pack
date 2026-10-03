# site/ - the hearth client pack download page

a second way for players to get the pack, next to the .mrpack calcifer attaches
to the status card in discord. one static page that serves the .mrpack itself
with the install steps, both connect addresses, the pack version, the counts and
what changed for players in the current release.

the copy leads with the thing that matters here and does not on the foundry:
**the pack is optional**. the hearth runs a vanilla-client rule, a plain client
joins, bedrock joins, and an out of date pack still connects because everything
in it is client-side. the page says all three out loud instead of implying a
requirement that does not exist.

## build

```sh
node client-pack/site/build_site.js
```

zero deps, node builtins only, no network. writes:

```
client-pack/site/build/index.html                            the page
client-pack/site/build/downloads/hearth-client-26.2-<ver>.mrpack   the pack itself
```

the stylesheet and favicon are NOT in the build: the page reads the hub checkout's
`public/css-manifest.json` and links its current `/cinderworks.<hash>.css` at the site root,
alongside `/cw-icon-32.png`. if the manifest is absent or invalid, it prints `CSS WARNING` and
keeps the legacy `/cinderworks.css` link. opening `build/index.html` straight off disk therefore
renders unstyled now - the download link still works, but for a styled look serve it the way
caddy mounts it (see "checking it").

## where the numbers come from

everything on the page is read out of this repo. nothing is typed twice.

- `client-pack/*.mrpack` - newest by **version**, not by mtime, so a rebuild of
  an older version does not win. gives the filename, size, sha256 and build date,
  plus the "previous builds" list.
- `build_mrpack.py` - `MC`, `FABRIC_LOADER` and `PACK_VERSION` are read straight
  out of it, and the mod / shader / resource pack counts come from counting the
  tuples in `MODS_*`, `SHADERS` and `RESOURCEPACKS`. a loader bump or a new mod
  edits one file, not two. the build prints a warning if `PACK_VERSION` is ahead
  of the newest built `.mrpack` - that is the one failure mode that would ship a
  page advertising a sha256 nobody can reproduce.
- `overrides/` - walked off disk for the "N files under overrides/" count. that
  is the honest number and there is no list of them anywhere else.
- `build_site.js` - the current release has exactly three player-facing summary
  lines plus its optional-pack compatibility warning. summary wording is kept
  verbatim from the pack README. the full history links to the canonical
  `CHANGELOG.md` on github.
- the hub checkout's `public/facts.json` - read-only server addresses, minecraft
  and loader versions, pack requirement, and published pack version. By default
  the build resolves `../../hearth-stack/cinderworks-web/public/facts.json` from
  this repo root. The estate-plan draft's `../../../hearth-stack/...` resolves
  to `~/Documents/hearth-stack/...` here, one directory too high. Set
  `CINDERWORKS_FACTS_PATH` to use another checkout. If it is absent or invalid,
  the build prints `FACTS WARNING` and uses the current rollout fallback values.
- the same hub checkout's `public/css-manifest.json` - the current hashed stylesheet name.
  Its default path has the same relative resolution as facts. Set
  `CINDERWORKS_CSS_MANIFEST_PATH` to use another checkout. If unavailable, the build prints
  `CSS WARNING` and falls back to `/cinderworks.css`.

the release summary is deliberately separate from the long README. keep it to
three player-facing lines, retain the selected README wording verbatim, and
leave technical detail in the canonical history.

## the knobs

top of `build_site.js`, in `CONFIG`:

- `factsPath` - the read-only hub facts source described above. The connect
  addresses, minecraft/loader values, pack requirement and pack version no
  longer belong in this generator's config.
- `cssManifestPath` - the read-only hub css manifest. Its hash is used for the root-absolute
  stylesheet link because this page and the hub share the cinderworks.dev origin.
- `ramGb` - the ram the install steps tell people to allocate. **this one is a
  recommendation, not a fact read out of a file** - nothing in the pack documents
  a ram figure. change it if 4g turns out to be wrong for 81 client mods plus
  shaders.
- `appUrl` / `serverPage` / `foundryPage` - the three outbound links.

## the design

the cinder works design system, the ember den (direction 01b). tokens, type,
links, the button bevel and the shared chrome come from the current
`/cinderworks.<hash>.css` at the site root, deployed by the cinderworks-web hub repo - this
build does not ship a stylesheet of its own anymore. the source of truth is
`cinderworks-design-system.html` in the paimon drop folder
(`cinderworks/design/system/`); if a page and that sheet disagree, the sheet
wins. `site/assets/hartforge.css` is the old workshop skin, no longer
referenced by the build - kept on disk until the re-skin is blessed, then it
can go.

page-local classes are all `hp-` prefixed, where the foundry's are `fp-`.
cinderworks.css owns the bare names (`page banner bl brand mark wordmark rev
tagline sec lbl rows arw desc btn btn-primary btn-ghost ...`) and reusing one
silently applies its layout. the two pages use different prefixes on purpose
so markup copied between them cannot pick up the other page's local rules.

colour roles are enforced, not decorative: grounds step night -> den, every
border is 1px pencil, text is cream/tallow/smoke, `--flame` is interactive and
the one accent. no glow anywhere, no gradients that read as firelight, and the
download button is the one bevel on the page (the shared `.btn-primary`,
verbatim).

**the grid trap, hit twice now.** `.hp-steps li` and `.hp-group li` are both
grids, so *every* child becomes a grid item. the text has to sit in a single
`<span>` or a bare `<b>` inside the sentence gets its own column and the line
comes apart vertically. the foundry page hit this on its install steps; this
page hit it on the changelog bullets on the first render, where `**bold**` runs
out of the README split every bullet into a ten-line stack. both are wrapped and
commented now. it is invisible in the html and obvious in a png.

## checking it

```sh
node --check client-pack/site/build_site.js
node client-pack/site/build_site.js
grep -o 'https\?://[^"< ]*' client-pack/site/build/index.html | sort -u
```

## facts rollout note

the pack filename and checksum still come from this pack checkout: they
describe the file being copied. The server-facing values rendered beside them
come from the hub facts source. During wave 3b, an unavailable facts file
is deliberately non-fatal so a pack release cannot be blocked by a missing hub
checkout; the warning is intentionally loud.

that last one should only ever list urls a human clicks (modrinth, hearth,
foundry). the page must make no external requests at all: the stylesheet and the
.mrpack are both same-origin, there is no script, no webfont, no analytics.

no internal hostnames belong on it either, since it is public. grep the built
page for lan ip ranges, internal host names and the deploy user before pushing a
new layout.

to look at it without a browser handy, mirror the caddy mounts in a throwaway
root (the stylesheet lives at the site root, so a bare file:// open is
unstyled) and shoot it over localhost:

```sh
root=$(mktemp -d); mkdir -p "$root/hearth/pack"
cp -R site/build/ "$root/hearth/pack/"
cp ~/Documents/projects/hearth-stack/cinderworks-web/public/cinderworks.42f76c7c127c51b4.css \
   ~/Documents/projects/hearth-stack/cinderworks-web/public/cw-icon-32.png "$root/"
python3 -m http.server 8377 -d "$root" -b 127.0.0.1 & pid=$!
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=860,4600 \
  --default-background-color=14100e \
  --screenshot=site/build/preview.png \
  "http://127.0.0.1:8377/hearth/pack/"
kill $pid
```

`preview.png` is a build artefact, not something to serve - the rsync excludes
it.

one gotcha if you go looking for a phone render: headless chrome on this mac
will not lay out below about 500px no matter what `--window-size` says. a
`--window-size=390` shot comes back 390px wide but laid out at ~520 and clipped
on the right, which reads exactly like a horizontal overflow bug and is not one.
check narrow layout in a real browser window instead.

## deploying

```sh
./site/deploy.sh
```

that is `node site/build_site.js` then an rsync of `site/build/` to the caddy
webroot, and it prints the status codes at the end. `./site/deploy.sh --build`
builds without pushing. the rsync target and the lan address used for the check
come from `site/deploy.env` (gitignored, not in this repo). it needs
`HEARTHPACK_TARGET` (`user@host:/path/`) and `HEARTHPACK_LAN_IP`.

build the pack FIRST if the pack itself changed - the page reads the newest
`.mrpack` for its version, size and sha256:

```sh
python3 build_mrpack.py
./site/deploy.sh
```

each release also needs a three-line `player_summary` entry for its version in
`RELEASES` at the top of `build_site.js`, or the build refuses.

there is deliberately no timer and no cron. the page only changes when a pack is
built, and a pack is only ever built by hand.

the rsync has **no `--delete`**. `downloads/` is additive so a `.mrpack` link
already pasted into discord keeps resolving after a bump.

**a version bump is more than this page.** the discord status card, the github
release and the modrinth version are separate steps, they are not done by this
script.

## hosting

live at <https://cinderworks.dev/hearth/pack/> since 08-31-2026.
`hearthpack.hartforge.dev` redirects there, path-preserving. the hosting notes
that used to live here were infrastructure detail and moved out of this public
repo.
