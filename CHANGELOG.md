# the hearth pack - changelog

what changed in the pack, newest first. versions before 2.0.0 predate this
repo.

## 2.2.3 (09-27-2026)

- distant horizons moves to the 3.3.2 release line on both halves, unblocked by
  a server fabric-loader bump to 0.19.5. what it brings: reverse-Z depth
  rendering, iris shadow and depth fixes, and about half the disk work. your
  local LOD database migrates itself on first launch - give it a moment.
- kotlin runtime lands on 1.14.1 both sides, closing out the version splits.
- nothing else changes from 2.2.2; if you already imported 2.2.2 this is a
  small update, and if you're coming from 2.2.1 you get both at once.
- re-import the pack.

## 2.2.2 (09-26-2026)

- viaversion and viabackwards move off snapshot builds onto the real 5.12.0 release on the server. nothing changes for you, it just means older clients are connecting through a build that shipped rather than one that was cut nightly.
- the server's kotlin runtime catches up to the client's at 2.4.20, so both halves run the same one for the first time since 2.2.0.
- client bumps: fabric api 0.161.0 (with the server), yacl 3.9.7, iceberg 1.4.2.2, sodium extra 0.9.4 and reese's sodium options 2.2.4, immediately fast 1.16.5, ixeris 4.6.8, modernfix 5.27.19-build.2, 3d skin layers 1.11.3, not enough animations 1.12.5, entity texture features 7.2.4, wavey capes 1.11.2, modmenu 20.0.3, controlling 26.2.4, zoomify 2.16.3, debugify 26.2.0.1, shulker box tooltip 5.4.1, stendhal 1.4.9, in-game account switcher 9.0.8, crash assistant 1.11.14, armored elytra 1.15.1 (with the server), xaero's minimap 26.5.1 and world map 1.46.1.
- both complementary shaders to r5.9.3 with euphoria patches matching, and whimscape r2 (two texture fixes; it still ships off).
- server-side bumps you won't see directly: collective, balm and forgiving void as a pair, luckperms, spark and fuji. lootr sat this one out - its new build shipped broken and gets picked up when a fixed one lands.
- distant horizons stays at 3.2.0-b on both halves for now: the new 3.3.2 release
  needs a newer fabric loader than the server runs. it moves in the next update.
- re-import the pack.

## 2.2.1 (09-26-2026)

- fixes 2.2.0 refusing to launch: fabric language kotlin 1.14.1 needs fabric
  loader 0.19.5 and the pack still pinned 0.19.3, so fabric bailed at startup.
  the pack now installs loader 0.19.5. no mod content changes.
- re-import the pack.

## 2.2.0 (09-26-2026)

- armored elytras are a real mod now instead of a datapack. forge one by putting a chestplate and an elytra in an anvil, split it back apart in a grindstone - same two actions, proper item handling underneath instead of datapack functions running every tick.
- the pack ships the client half of it, so an armored elytra actually looks like one: the chestplate renders on your back over the elytra, and the item gets its own icon per armour type.
- if you fused an elytra under the old datapack it keeps the armour it already had, but the grindstone won't split it back into a chestplate and an elytra once the datapack is gone. we checked every inventory, ender chest and worn slot on the server: exactly one exists and it's patrick's, so nobody else has anything to do. his rides through as-is and gets hand-fixed; if one ever turns up out of a chest in the wild, bring it to patrick.
- the server now trims its own mob cap, then simulation distance, then view distance when tick time starts climbing, and puts all three back when it settles. it's capped at the numbers the server already ran, so it can only dip below them and return - never go past them. you might see mobs thin out slightly at the busiest moments; that's it working.
- distant horizons has shipped in the pack but switched off since 2.1.0. the server now generates and serves the LODs, so turning it on (options, distant horizons, enable rendering) actually gets you terrain out past your render distance instead of empty space.
- named banners now show up as markers on the bluemap. place a banner, give it a name, and it appears on the web map.
- discord rich presence added (craftpresence). your discord shows "Cinder Works - The Hearth" while you're on. essential's own presence is switched off in the shipped config so the two don't fight over the discord pipe. the flame icon is still pending a cinder works discord app.
- jei 30.29.0.201, fabric api 0.160.0, fabric language kotlin 1.14.1 and audioplayer 2.5.0 all move on the server and the client at the same time. jei is finally on a release build instead of a beta.
- client bumps: sodium 0.9.2 and iris 1.11.4 together, complementary reimagined and unbound both on r5.9.2 with euphoria patches matching, make up ultra fast 9.5e, entity model features 3.3.8, xaero's minimap 26.5.0 and world map 1.46.0, litematica 0.28.8, modmenu 20.0.2, durability tooltip 1.2.0, wavey capes 1.11.1, whimscape r1 for 26.3.
- veinminer's client half added, matching the server. veinmine only fires while you hold the key, so the keybind is also your off switch - rebind or clear it in controls.
- twelve more server-side bumps you won't see directly: bluemap 5.24, fuji, tab, spark, polymer, puzzles lib, balm, skin restorer, almanac and let me despawn as a pair, and dungeons and taverns 5.3.2 (the last 26.2 build that line gets).
- re-import the pack.

## 2.1.1 (09-04-2026)

- crash fix, and the reason this release exists: 2.1.0 bumped entity texture features to 7.2.1 but left entity model features on 3.2.6, and etf 7.2.1 refuses to load next to emf below 3.3 - so 2.1.0 could fail at launch. emf goes to 3.3.5 and the pair is compatible again.
- jei 30.29.0.201, matched to the server's jei.
- armor hud 3.5.0, wavey capes 1.11.0.
- malilib 0.29.6 and litematica 0.28.7 (they move as a pair), xaero's world map 1.45.0.
- re-import the pack.

## 2.1.0 (09-03-2026)

- shaders now match the foundry: makeup ultra fast 9.5d, complementary reimagined and unbound both on r5.9, euphoria patches 1.10.0 (adds the end black hole and nebula). sildur's removed.
- distant horizons added but shipped OFF like the foundry: options, distant horizons, enable rendering to turn it on. the 26.2 build is beta.
- default dark mode added (gui dark theme, off by default).
- three bug-fix bumps: fabric api 0.159, lambdynamiclights 4.12.4 (options.txt keybind fix), entity texture features 7.2.1 (crash fix).
- re-import the pack.

## 2.0.1 (08-30-2026)

- icon refresh: the pre-added multiplayer entry now carries the hearth's campfire, so the server list looks like itself before your first ping. that is the whole of 2.0.1, no mods or configs changed

## 2.0.0 (08-30-2026)

- resource packs, finally: fresh animations 1.10.5 and its seven official addons ship on by default. whimscape ships present but off, so you can turn it on if you want the vanilla-plus look
- perf: krypton, language reload, ixeris, modernfix-mvus, scalablelux and cubes without borders. the join stall and the pack-reload stall are both gone
- visual: falling leaves, wavey capes, particle rain, visuality, puzzle, better block entities, animatica refabricated
- qol: not enough crashes, crash assistant, status effect bars, item highlighter, durability tooltip, armor hud
- audio: presence footsteps, per-block footstep sounds alongside sound-physics
- alt-tabbing no longer ducks your game audio to a quarter, voice chat included. that was dynamic-fps stock and it is fixed in the pack now
- 81 mods, 3 shaders, 9 resource packs. still optional, still nothing that changes how the game plays
