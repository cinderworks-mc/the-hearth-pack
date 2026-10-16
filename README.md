# the hearth client pack

[![discord](https://img.shields.io/discord/1560020457363738624?label=discord&logo=discord&color=e8742a)](https://discord.gg/ZmmtPNJUcK)

optional client-side mods, shaders and resource packs for the hearth. minecraft 26.3, fabric, java edition only. nothing in here is required to play: the server runs a vanilla-client rule and always will.

grab the latest `.mrpack` from [releases](https://github.com/cinderworks-mc/the-hearth-pack/releases) or the [modrinth page](https://modrinth.com/modpack/the-hearth-pack) and import it into your launcher. the [changelog](CHANGELOG.md) lists what moved in each release. to update, re-import the pack (the modrinth app offers the update on its own).

## what is in it

performance and quality of life mods, a few shaders (complementary reimagined and unbound, makeup ultra fast) and some resource packs. fresh animations and its addons are on by default. whimscape is installed but off. distant horizons is installed but off until you turn it on in the options.

## the resource pack setup

the enabled set lives in one line of `overrides/config/defaultoptions/options.txt`:

```
resourcePacks:["vanilla","file/FreshAnimations_v1.10.5.zip","file/FA+Details-v2.3.zip", ...]
```

default-options only applies that line when a player has no `options.txt` yet, so it is a first-run default and a pack update never re-imposes it.

later entries win. the list runs lowest priority first, so the last entry shows at the top of the in-game list, and `vanilla` always goes first. the fresh animations addons sit after the base pack for that reason. fresh animations documents no order among the addons themselves.

whimscape ships off on purpose. it carries its own entity models, and a pack with entity models overrides fresh animations' models and animations, so the two fight and whichever is higher wins. if you turn whimscape on, put it below fresh animations in the menu and the animations keep working while its blocks, items and ui still apply. kavast publishes a compat patch for the two, and we will ship it once it supports our minecraft version.

etf, emf and optigui have no ordering requirement. every pack we ship declares a pack format that covers current minecraft, so none of them land in the incompatible list on load.

the server also offers an optional pack of its own (drinks, gliders, keepsakes). it layers on top of whatever you enabled and does not wipe your choices.

## one plain override

`overrides/config/dynamic_fps.json`. stock dynamic-fps drops all game audio to 25 percent when the window loses focus, which also quiets simple voice chat. ours keeps it at 100 percent and raises the unfocused frame target from 1 to 10 fps. a minimised window stays muted, since that means you are away.

unlike everything under `defaultoptions`, this file is re-applied on every update and will overwrite local edits to it. it is the only plain override in the pack.

## nothing third party is bundled

no jars, no shader zips, no resource pack zips. every entry is a reference to the author's own upload on the modrinth cdn, so the launcher downloads each file from its source. several of these licences do not allow redistribution, and a reference is not a redistribution. `overrides/` holds only our own files.

## building it

```
python3 build_mrpack.py
```

every entry is resolved live against the modrinth api, and the build fails if any one of them breaks a rule: it must be a `release` (or be listed in `ALLOW_BETA` with a reason), list the pack's minecraft version, be hosted on `cdn.modrinth.com`, carry sha1 and sha512 hashes, and pass a live HEAD request whose content length matches the api.

resolved entries are cached in `resolve-cache.json` (gitignored), so a rebuild where nothing changed makes no api calls. entries with no pinned version are always resolved live. a cache hit still re-checks the download with a live HEAD once the cached length is older than 7 days, so a moved or pulled file is caught.

```
python3 build_mrpack.py --refresh               # ignore the cache, resolve everything live
python3 build_mrpack.py --refresh jei sodium    # bust only the cached lines matching these
python3 build_mrpack.py --selftest              # offline cache check, no network, no build
```

## shipping a release

`tools/publish.sh <version>` copies the built pack's source in, commits, tags and pushes. then:

```
gh release create <tag> <mrpack> -R cinderworks-mc/the-hearth-pack
gh release view <tag> -R cinderworks-mc/the-hearth-pack --json isDraft,assets
```

`isDraft` must be `false` and the mrpack must be attached.

## left out on purpose

- resourcify: it bundles universalcraft, which collides with the copy inside essential and crashes at launch.
- other borderless fullscreen mods: cubes without borders declares twenty of them incompatible.
- particle-core: it can hide potion particles, which hides invisibility and effect tells on other players.
- nvidium: opt-in, nvidia turing and newer only, and it turns itself off under iris.
- first person model: there is no way to ship it off by default, it is on or out.
- inventory profiles next: pulled in 1.9.0, no safe default exists.
- zfastnoise, c2me, servercore and vmp: worldgen and server tick mods, nothing for a client to do.
- skyboxify and polytone: both need a pack we do not ship, and polytone is beta.
- cheat adjacent mods: freecam, tweakeroo, minihud, seedcracker, xray, fullbright, litematica printer, auto clickers and axiom.

## bedrock

java only. an `.mrpack` is a fabric manifest and nothing in it ports to bedrock.
