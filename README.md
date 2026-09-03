# the hearth client pack

optional client-side mods, shaders and resource packs for the hearth.
mc 26.2, fabric loader 0.19.3, java only. nothing in here is required to play -
the server runs a vanilla-client rule and always will.

current build: `hearth-client-26.2-2.1.0.mrpack`
95 entries: 82 mods, 3 shaderpacks, 10 resourcepacks.

## build it

```
python3 build_mrpack.py
```

every entry is resolved live against the modrinth api and the build dies if any
one of them fails: must be `release` (or listed in `ALLOW_BETA` with a reason),
must list 26.2, must be hosted on cdn.modrinth.com, must carry sha1 + sha512,
and must pass a live HEAD whose content-length matches the api.

**nothing third-party is bundled.** not the jars, not the shader zips, not the
resource pack zips. all of it is cdn references, so the launcher pulls each file
from the author's own upload. that is a reference, not a redistribution, which
is what keeps complementary's licence, sildur's ARR, whimscape's ARR and fresh
animations' terms-of-use all happy at once. `overrides/` carries only our own
files.

### the resolve cache

a resolved entry is remembered in `resolve-cache.json` (next to this script,
gitignored) keyed by its `(slug, pinned version, filename, dest)` identity, so
a rebuild where nothing changed costs zero modrinth api calls - only entries
with no pinned version (`pin=None`, "whatever is newest release") stay live on
every build, same reasoning as an unpinned `-` line in the foundry's
`manifest.txt`. `ALLOW_BETA` is re-checked against the cached version type on
every hit, so dropping a slug out of it still fails the build instead of
sailing through on a stale hit.

a cache hit skips the api lookups but not the safety net: the cached
content-length is trusted for up to 7 days, then re-verified with a live HEAD
and the timestamp refreshed - so a moved or pulled download still gets caught
without needing a full re-resolve.

```
python3 build_mrpack.py --refresh              # ignore the cache entirely, re-resolve everything live
python3 build_mrpack.py --refresh jei sodium    # bust only the cached lines matching these (case-insensitive)
python3 build_mrpack.py --selftest              # offline cache round-trip check, no network, no build
```

the build ends with `resolved N from cache, M live` so you can see the cache
working.

## what 2.1.0 adds over 2.0.1

aligns the shader and resource pack lineup with the foundry's (dropped
sildur's, added complementary-unbound), ships distant horizons off by
default like the foundry, and folds in three routine mod bug-fix bumps.

### mods

- **distant horizons** 3.2.0-b-26.2 added, shipped OFF: the mod is present
  but rendering is disabled by default (config/defaultoptions DistantHorizons
  quickEnableRendering=false, exactly the foundry's setup). turn it on in
  options -> distant horizons -> enable rendering. 26.2 only has beta builds,
  same as the foundry ships.
- **fabric-api** 0.158.0 -> 0.159.0.
- **lambdynamiclights** 4.12.3 -> 4.12.4 (fixes a keybind bug that could
  corrupt options.txt).
- **entity texture features** 7.1.1 -> 7.2.1 (crash fix).

### shaders

- **complementary shaders - unbound** r5.9 added, alongside reimagined
  (both bumped to r5.9). same author, same custom licence, same cdn-reference
  treatment.
- **makeup - ultra fast** 9.5c -> 9.5d, and both complementary shaders to r5.9.
- **sildur's vibrant shaders** removed entirely. the foundry dropped it
  08-26-2026 and its Extreme-VL file is gone from modrinth anyway.
- both **complementary** shaders bumped r5.8.1 -> r5.9, and **euphoria-patches**
  moved with them to `1.10.0-r5.9-fabric` (lockstep). euphoria 1.10.0 adds a
  black hole and nebula in the end among other effects; it patches both
  reimagined and unbound.

### resource packs

- **default dark mode** 2026.6.0-26.2 added, GUI-only dark theme by nebulr.
  shipped present, same off-by-default posture as whimscape - not in the
  default-enabled `resourcePacks:` line.

two others were evaluated and skipped, both checked live against modrinth:

- **whimscape-x-fresh-animations** - still no 26.2 build. newest release is
  still `26.1_r1` (04-15-2026), capped at `max_format: 84` while whimscape's
  own 26.2 build needs `84-88`. this was the known risk flagged the last time
  this section was written; unchanged, worth another look whenever kavast
  ships one.
- **whimscape-exploration** - no 26.2 build either. newest release is `2.1`
  (08-2025), which tops out at 1.21.1; nothing published since.
- **`fa-player-extension-x-better-combat`** was deliberately not evaluated -
  better-combat is a foundry-only mod, so the compat pack has no place here.

## what 2.0.1 adds over 2.0.0

icon only. no mods, no resource packs, no config changes, nothing that touches
how the game plays or performs.

### the hearth has its own icon now

the multiplayer entry the pack pre-adds carries the hearth's campfire, so it
shows up in your server list looking like itself from the moment you install,
instead of the grey unknown-server tile you get until your first successful
ping. same art as the modrinth page and the discord card.

it rides inside the servers.dat nbt as a base64 png, not as a loose file, so
nothing new lands in your instance folder. `make_servers_dat.py` builds it from
`client-pack/hearth-icon.png` and refuses anything that is not 64x64.

if you already have the hearth in your list, default-options leaves your
existing servers.dat alone (that is the whole point of it) - so this only shows
up on a fresh install. re-importing is optional and changes nothing else.

## what 2.0.0 adds over 1.10.1

62 -> 93 entries. +20 mods, +1 library, +9 resource packs, +1 config file.

### resource packs, the new capability

we shipped etf + emf + optigui for months and never shipped a payload for them.
now we do.

- **fresh animations** 1.10.5 (beta), the base pack. **on by default.**
- **its seven official addons**, all release, all **on by default**:
  details 2.3, objects 2.1.2, emissive 1.6, spiders 2.2, creepers 2.1,
  quivers 2.2, player extension 1.1.
- **whimscape** 26.1-26.2_r1, vanilla-plus overhaul. **shipped present, off.**

deliberately not shipped: `fresh-animations-extensions`, the FA+All_Extensions
bundle. it is just the six standalone addons above plus classic horses in one
zip, so shipping both would stack two copies of the same content at two
different versions and let load order decide which half you get. the only thing
in that bundle we do not ship standalone is **classic horses** (1.6.0, reverts
horses to their pre-1.13 look). it was not on the list, it is a taste change
rather than a fidelity one, and it is one line to add if he wants it. slamacow
was folded into details upstream, so it needs no entry.

### mods

perf: **krypton** 0.3.1 (netcode rewrite, cuts the join stall), **language
reload** 1.7.7 (kills the multi-second stall on every pack reload, which matters
far more now that packs ship), **ixeris** 4.6.5 (threaded input polling, kills
mouse stutter), **modernfix-mvus** 5.27.19-build.1, **scalablelux** 0.2.1
(starlight-derived client light engine), **cubes without borders** 4.1.0
(borderless fullscreen).

visual: **falling leaves** 2.0.7, **wavey capes** 1.10.2 (the motion half of the
`capes` mod already in), **particle rain** v4-beta.11, **visuality** 0.7.14,
**puzzle** 2.3.1 (a config gui for the etf/emf/continuity/optigui stack we have
been shipping blind), **better block entities** 1.3.7 (hybrid chest/sign/bed
renderer, which is where frames die in a storage room), **animatica
refabricated** 0.6.3 (optifine animated-texture format, only earns its place now
that packs ship).

audio: **presence footsteps** 1.13.3 (per-block footsteps, pairs with
sound-physics).

qol: **not enough crashes** 4.4.9, **crash assistant** 1.11.12, **status effect
bars** 1.0.12, **item highlighter** 1.2.2, **durability tooltip** 1.1.6,
**armor hud** 3.4.

nec and crash-assistant are both in on purpose. they are not the same mod: nec
keeps you in the game after a client crash, crash-assistant explains the corpse
afterwards.

library: **supermartijn642's config lib** 1.1.8, a hard dependency of durability
tooltip. that is the only new dependency any of this pulled in. better block
entities needs sodium and the rest need fabric-api, both already shipping, and
nothing declared fzzy-config or configmanager.

bumps: immediatelyfast 1.16.3 -> 1.16.4, jei 30.24.0.173 -> 30.25.0.177 (now
matched to the version the server actually runs).

three new beta exceptions in `ALLOW_BETA`, each because it is the only 26.2 build
in existence: fresh animations, particle rain, visuality. the eight fa addons are
all release builds and needed no exception.

### one config file

`overrides/config/dynamic_fps.json`, which keeps voice chat audible while you are alt-tabbed (stock dynamic-fps ducks master volume to 25% when the window loses focus).

## the resource pack rule

this is the part that is easy to get wrong, so it is written down.

**the enabled set lives in one line** of
`overrides/config/defaultoptions/options.txt`:

```
resourcePacks:["vanilla","file/FreshAnimations_v1.10.5.zip","file/FA+Details-v2.3.zip","file/FA+Objects-v2.1.2.zip","file/FA+Emissive-v1.6.zip","file/FA+Spiders-v2.2.zip","file/FA+Creepers-v2.1.zip","file/FA+Quivers-v2.2.zip","file/FA+Player-v1.1.zip"]
```

whimscape is downloaded to `resourcepacks/` and is deliberately not in that
list, so it sits in the menu waiting to be turned on. `default-options` only
applies this when the player has no options.txt yet, so it is a first-run
default and never something re-imposed on a pack bump. same non-destructive
posture as the server list.

**order matters, and later is stronger.** in options.txt the list runs
lowest-priority first, so the **last** entry wins and is what shows at the
**top** of the in-game selected list. `"vanilla"` is always first for that
reason. verified two ways: freshlx's own load-order diagram shows the addons
sitting above the base pack in the menu, and real-world options.txt files put
those addons after the base in the list.

so the line reads bottom-of-menu to top: vanilla, then fresh animations, then
the addons. freshlx's diagram says "any combination of add-on packs, always
listed above Fresh Animations" and gives **no required order among the addons
themselves**, so ours are just in a stable alphabetical-ish order with the
player extension last.

### whimscape, and the compat pack that does not exist yet

whimscape is not a texture-only pack. it ships 999 files under
`assets/minecraft/optifine/cem/`, its own entity models, and fresh animations'
FAQ is explicit that a pack with entity models overrides FA's models and
animations. so the two genuinely fight, and whoever is higher wins.

there **is** an official fix: kavast publishes `whimscape-x-fresh-animations`,
a patch that makes the two work together, and its documented order is
whimscape -> fresh animations -> the patch on top. **it has no 26.2 build.** the
newest release is `26.1_r1` (04-15-2026) and its pack.mcmeta is
`min_format: 84, max_format: 84`, while whimscape's own 26.2 build runs
`84 to 88`. so on 26.2 minecraft would flag the patch as outdated rather than
load it. it is not shipped, and it cannot be until kavast cuts a 26.2 build -
worth re-checking when whimscape next updates.

until then, a player who turns whimscape on is choosing between the two looks.
put whimscape **below** fresh animations in the menu (so, **before** it in the
options.txt list) and the animations keep working while whimscape's blocks,
items and ui still apply:

```
resourcePacks:["vanilla","file/Whimscape_26.1-26.2_r1.zip","file/FreshAnimations_v1.10.5.zip", ...addons]
```

kavast's own notes add that FA **objects** and FA **player** should go *below*
whimscape when both are on. that only matters once the compat patch exists, so
it is recorded here rather than baked into the default line.

### the rest of the ordering notes

etf and emf themselves have no ordering requirement. they are mods, they read
whatever the pack stack ends up being. optigui is the optifine gui-texture half
and is unrelated to fresh animations. every pack we ship declares
`min_format: 84` with a max at or above 26.2's format, so none of them get
kicked into `incompatibleResourcePacks` on load.

one known interaction: the server auto-hosts an optional polymer pack (drinks,
gliders, keepsakes) with `clear_all_client_resource_packs: false`, so it layers
on top of whatever the player enabled rather than wiping it. the server pack's
model overrides still win.

## the dynamic-fps fix

`overrides/config/dynamic_fps.json`, lifted from what the `additive` pack ships.

dynamic-fps stock sets `states.unfocused.volume_multipliers.master` to **0.25**,
so alt-tabbing ducks all game audio to a quarter, **including simple voice
chat**. on a server where people talk while doing something else, that is a bug,
not a feature. ours sets it to `1.0` and lifts the unfocused frame target from
1 to 10 fps so the client is not a slideshow when you tab back.

`states.invisible` (window actually minimised) is left at master `0.0`,
unchanged from stock. that is a deliberate line: unfocused means you are still
there, minimised means you are not. flip it if that turns out to be wrong.

this is a **plain override, not a defaultoptions payload**. default-options
cannot do mod configs, so this file gets re-applied on every pack update and
will clobber a player's own dynamic-fps edits. that trade is accepted here
because the stock value is broken for us and nobody deliberately tunes this
file. it is the only plain-override config in the pack.

## bedrock

the pack is java only. an `.mrpack` is a fabric-loader manifest, there is no
bedrock equivalent and nothing in it ports. no shaders, no minimap, no voice
chat, no jade.

there is exactly one thing that could be offered, and it is **not done, it is
patrick's call**: whimscape publishes a bedrock `.mcpack`. geyser's pack
directory on dionysus is `/srv/minecraft/calcifer/config/Geyser-Fabric/packs/`
and it is empty today. a `.mcpack` dropped there is sent to every bedrock client
on join, and `force-resource-packs: true` is already set at line 109 of
`config.yml`, so it would be **forced rather than offered**. that is the whole
decision: bedrock players would not get to say no. flip force-resource-packs
first if that is not wanted.

## deliberately out

- **resourcify.** never add it. it bundles UniversalCraft, which collides with
  the copy inside `essential`, and the result is a `ResolutionException` at
  launch. that is the exact crash the foundry pack hit on 08-29-2026. an in-game
  pack browser is not worth breaking essential.
- **any other borderless-fullscreen mod.** cubes-without-borders declares 20 of
  them explicitly incompatible, borderless-mining included.
- **particle-core.** its per-type spawn knobs can hide potion particles, which
  hides invisibility and effect tells on other players. visibility change on a
  shared server, so it stays out.
- **fresh-animations-extensions** (the bundle), see above.
- **distant horizons.** ranked well, cut on purpose for now. beta-only on 26.2.
- **nvidium.** documented opt-in, nvidia turing+ only, self-disables under iris.
- **first person model.** no way to ship it default-off, it is on or out.
- **inventory profiles next.** pulled in 1.9.0, no safe default exists.
- **zfastnoise, c2me, servercore, vmp.** singleplayer worldgen and server-tick
  mods. nothing to do when the world lives on dionysus.
- **skyboxify, polytone.** both need a pack we do not ship, polytone is beta.
- **cheat-adjacent:** freecam, tweakeroo, minihud, seedcracker, xray,
  fullbright/gamma, litematica-printer, auto-clicker, axiom.

## still on the table

from the peer-pack comparison, not done here: `config/iris.properties`
(kills the shader update nag), `config/NoChatReports/NCR-Client.json` (kills the
signing toast and the red indicator on every join, for a thing already handled
server-side by `enforce-secure-profile=false`), `config/modmenu.json`
(`update_checker:false`), and the first-launch options.txt lines
`telemetryOptInExtra:false` / `skipMultiplayerWarning:true` /
`joinedFirstServer:true` / `tutorialStep:none`. all cheap, none decided.

## the other docs

`OVERRIDES.md` is the long-form version of why anything ships under
`config/defaultoptions/` at all, and what deliberately does not ship.
`make_servers_dat.py` writes the servers.dat nbt by hand.
