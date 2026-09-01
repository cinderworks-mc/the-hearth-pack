#!/usr/bin/env python3
"""build the hearth client .mrpack for mc 26.2 / fabric.

every file is pinned to an exact modrinth version and resolved live against the
modrinth api. NO THIRD-PARTY CONTENT is bundled under overrides/ - not the mods,
not the shaderpacks and not the resource packs. those zips are referenced by
their official cdn.modrinth.com url exactly like the mods are, so the launcher
fetches each one from the author's own upload. that is a reference, not a
redistribution, which is what keeps the restrictive licences (complementary's
custom licence, sildur's ARR, whimscape's ARR) happy.

overrides/ carries only OUR OWN files. most of it sits under
config/defaultoptions/ - the payload for the default-options mod, which applies
those when the target file is MISSING rather than overwriting on every pack
update. that is what makes it safe to ship a server list and options at all.
the one exception is config/dynamic_fps.json, a plain override that DOES get
re-applied on every update; that is accepted deliberately because the stock
value ducks voice chat when a player alt-tabs. see OVERRIDES.md for what belongs
where and what deliberately does not ship.

every entry must pass, or the build dies:
  - upstream version_type == "release" (or the slug is in ALLOW_BETA, with a reason)
  - the version lists game version 26.2
  - the file is hosted on cdn.modrinth.com
  - the file carries both a sha1 and a sha512
  - a live HEAD on the url returns 200 with a content-length matching the api

resolving ~92 entries live is two api calls plus a HEAD each, politely spaced - enough
to trip modrinth's rate limit on repeat builds. so a resolved entry is remembered in
resolve-cache.json (next to this script), keyed by the exact (slug, pin, filename, dest)
identity, and a line that has not changed costs zero API calls on the next build.
--refresh bypasses the cache entirely, --refresh <slug> busts just the cached lines whose
identity contains that text. an entry with no pinned version (pin=None, "whatever is
newest release") is deliberately never cached - same reasoning as a `-` pin in the
foundry's manifest.txt: caching a moving target would silently freeze it.

a cache hit skips the two modrinth API calls but still confirms the download exists:
the cached content-length is trusted for up to HEAD_RECHECK_DAYS, then re-HEAD'd live
and refreshed. ALLOW_BETA is policy, not network, so it is re-checked against the cached
version_type on every hit - dropping a slug out of ALLOW_BETA still fails the build
instead of sailing through on a stale hit.
"""
import argparse, calendar, json, os, sys, tempfile, time, urllib.error, urllib.request, zipfile

MC = "26.2"
FABRIC_LOADER = "0.19.3"
PACK_NAME = "The Hearth"
PACK_VERSION = "2.0.1"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, f"hearth-client-{MC}-{PACK_VERSION}.mrpack")
CACHE_FILE = os.path.join(HERE, "resolve-cache.json")
CACHE_VERSION = 1               # bump to invalidate every cached entry at once
HEAD_RECHECK_DAYS = 7            # a cache hit trusts its cached content-length up to this long

# a few mods have never cut a "release" build on 26.2 even though the beta
# line is what everyone runs. each one here is a deliberate exception to the
# release-only rule below, with the reason, and is still held to every other
# assertion (26.2 listed, modrinth-hosted, hashes, live HEAD).
ALLOW_BETA = {
    "sound-physics-remastered",  # 1.5.1+26.2 is the only 26.2 build, beta-tagged since june
    "jei",                       # jei's entire 26.2 line (140+ builds) is beta-tagged, no release exists
    "optigui",                   # 2.3.0-beta.10+26.2 is the only 26.2 build
    # added in 2.0.0
    "fresh-animations",          # 1.10.5 is the only 26.2 build; FA has shipped beta-tagged for years
    "particle-rain",             # v4-beta.11+26.2-fabric is the only 26.2 build
    "visuality",                 # 0.7.14+26.2 is the only 26.2 build
}

# each entry: (slug, pinned version_number or None, exact filename or None)
# filename is only needed where one version_number covers several files
# (sildur's ships every quality tier under the same version number).

MODS_CORE = [
    ("fabric-api",               "0.158.0+26.2",          None),
    ("cloth-config",             "26.2.155+fabric",       None),
    ("placeholder-api",          None,                    None),
    ("yacl",                     "3.9.6+26.2-fabric",     None),
    ("fabric-language-kotlin",   "1.13.13+kotlin.2.4.10", None),
    ("searchables",              "1.0.1",                 None),
    ("tcdcommons",               "5.5.6+fn-26.2",         None),
    ("prism-lib",                "1.1.2",                 None),
    ("iceberg",                  "1.4.2.1",               None),
    # default-options applies overrides/config/defaultoptions/* ONLY when the
    # real file is missing, so a fresh install gets the hearth pre-added and
    # sane distances while an existing player's settings survive every update.
    # balm is its required library.
    ("balm",                     None,                    None),
    ("default-options",          None,                    None),
    ("creativecore",             "2.14.16",               None),  # ambientsounds
    ("supermartijn642s-config-lib", "1.1.8-fabric-mc26.2", None),  # durability-tooltip
]

MODS_PERF = [
    ("sodium",                   "mc26.2-0.9.1-fabric",   None),  # RELEASE, not the 0.9.2 alphas
    ("lithium",                  "mc26.2-0.25.3-fabric",  None),
    ("sodium-extra",             "mc26.2-0.9.3+fabric",   None),
    ("reeses-sodium-options",    "mc26.2-2.2.3+fabric",   None),
    ("immediatelyfast",          "1.16.4+26.2-fabric",    None),
    ("ferrite-core",             "9.0.0-fabric",          None),
    ("moreculling",              "1.8.1",                 None),
    ("dynamic-fps",              "3.11.9",                None),
    ("entityculling",            "1.10.5",                None),
    ("bobby",                    "5.2.15+mc26.2",         None),
    ("krypton",                  "0.3.1",                 None),  # netcode rewrite, cuts join stall
    ("language-reload",          "1.7.7+26.2",            None),  # kills the resourcepack-reload stall
    ("ixeris",                   "4.6.5+26.2-fabric",     None),  # threaded input polling, kills mouse stutter
    # the modernfix FORK. the original `modernfix` slug genuinely has no 26.2
    # build; `modernfix-mvus` does, and 5 of the 8 popular client packs run it.
    ("modernfix-mvus",           "5.27.19-build.1",       None),
    ("scalablelux",              "0.2.1+fabric.2b08348",  None),  # starlight-derived client light engine
    # borderless fullscreen. this is the `borderless-mining` replacement - and
    # it declares every other borderless mod INCOMPATIBLE, so never add one.
    ("cubes-without-borders",    "4.1.0+26.2",            None),
]

MODS_VISUAL = [
    ("iris",                     "1.11.2+26.2-fabric",    None),
    ("continuity",               "3.0.1+26.2",            None),
    ("3dskinlayers",             "1.11.2",                None),
    ("capes",                    "1.5.11+26.2",           None),
    ("lambdynamiclights",        "4.12.3+26.2",           None),
    ("not-enough-animations",    "1.12.4",                None),
    ("chat-heads",               "1.2.8",                 None),
    # optifine-format resource pack support (fresh animations etc). emf needs etf.
    ("entitytexturefeatures",    "7.1.1-fabric-26.2",     None),
    ("entity-model-features",    "3.2.6-fabric-26.2",     None),
    ("optigui",                  "2.3.0-beta.10+26.2",    None),
    # add-on for the complementary reimagined shader below. it patches a COPY
    # of the shader in shaderpacks/, base stays intact. lockstep rule: bump
    # complementary -> bump this to the matching r-version.
    ("euphoria-patches",         "1.9.3-r5.8.1-fabric",   None),
    ("fallingleaves",            "2.0.7+26.1",            None),  # lists 26.2, ambient leaf particles
    ("wavey-capes",              "1.10.2",                None),  # the motion half of `capes`
    ("particle-rain",            "v4-beta.11+26.2-fabric", None),  # biome weather, ALLOW_BETA
    ("visuality",                "0.7.14+26.2",           None),  # ambient mob particles, ALLOW_BETA
    # config gui + glue for the optifine-alternative stack above (etf, emf,
    # continuity, optigui), which we have shipped with no config surface at all.
    ("puzzle",                   "2.3.1+26.2-fabric",     None),
    ("better-block-entities",    "1.3.7+mc26.2",          None),  # needs sodium (perf), already in
    # optifine animated-texture format. the `animatica` fork - the original slug
    # has no 26.2 build. only earns its place now that resource packs ship.
    ("animaticarefabricated",    "0.6.3+26.2",            None),
]

MODS_AUDIO = [
    ("sound-physics-remastered", "fabric-1.5.1+26.2",     None),  # occlusion/reverb, svc-aware
    ("ambientsounds",            "6.3.6",                 None),  # needs creativecore (core)
    # per-block footsteps. embeds its own kirin lib, so no extra core entry.
    ("presence-footsteps",       "1.13.3+26.2",           None),
]

MODS_QOL = [
    ("modmenu",                  "20.0.1",                None),
    ("jade",                     "26.2.11+fabric",        None),
    ("appleskin",                "3.0.10+mc26.2",         None),
    # 1.10.0: rei -> jei. rei looked broken on 26.2 (recipes are
    # server-authoritative since 1.21.2); jei ships a server jar for that,
    # which lives in the server's hearth-mods.nix. architectury-api left with rei.
    ("jei",                      "30.25.0.177",           None),  # matched to the server's jei
    ("controlling",              "26.2.2",                None),
    ("betterf3",                 "19.0.0",                None),
    ("legendary-tooltips",       "1.6.2.1",               None),  # 1.6.2 crashed with jei 30.24.0.173 (its jei mixin), fixed upstream 08-18
    ("mouse-tweaks",             "26.2-2.31-fabric",      None),
    ("zoomify",                  "2.16.1+26.2",           None),
    ("better-stats",             "5.5.6+fn-26.2",         None),
    ("debugify",                 "26.2.0.0",              None),
    ("simple-voice-chat",        "fabric-2.6.22+26.2",    None),
    ("shulkerboxtooltip",        "5.4.0+26.2-fabric",     None),
    ("morechathistory",          "2.0.0",                 None),
    ("fadeless",                 "2.0.8-26.2",            None),
    ("lighty",                   "4.0.1+26.2",            None),  # light overlay, f7/f8
    ("stendhal",                 "1.4.8-26.2",            None),  # book/sign editor
    # strips chat signatures. harmless on the hearth: enforce-secure-profile=false
    # is already set server-side. also disables mojang telemetry (so no separate
    # no-telemetry mod).
    ("no-chat-reports",          "Fabric-26.2-v2.20.2",   None),
    ("in-game-account-switcher", "9.0.7+26.2-fabric",     None),
    ("essential",                "1.4.1.1",               None),
    # same patcher the foundry ships; fixes essential's launcher-side patching
    # (controls essential's ads/purchase-prompts/telemetry). modrinth flags are
    # 'unknown' both sides, description confirms client-only.
    ("essential-patcher",        "1.0.8",                 None),
    # added in 2.0.0
    ("notenoughcrashes",         "4.4.9+26.2-fabric",     None),  # crash drops to the menu, not the desktop
    ("status-effect-bars",       "1.0.12",                None),  # duration bars on potion effects
    ("item-highlighter",         "1.2.2",                 None),  # new hotbar items flash. needs iceberg
    ("durability-tooltip",       "1.1.6-fabric-mc26.2",   None),  # needs supermartijn642s-config-lib
    ("armor-hud",                "3.4-26.2",              None),
    # kept alongside notenoughcrashes on purpose, they do different jobs: nec
    # keeps the session alive after a client crash, crash-assistant explains the
    # corpse afterwards and points at somewhere to report it.
    ("crash-assistant",          "1.11.12",               None),
]

# NOT in the pack, documented opt-in: nvidium (nvidia turing+ only, beta,
# hard-pinned to sodium 0.9.1, self-disables under iris shaders, author warns
# of unexpected termination). players who want it install it themselves.
#
# NEVER add `resourcify`. it bundles UniversalCraft, which collides with the
# copy inside `essential` and throws a ResolutionException at launch - the exact
# crash the foundry pack hit on 08-29-2026. an in-game resource pack browser is
# not worth breaking essential for.

# schematics / building. litematica needs malilib (masa's shared library).
#
# NOT included: litematica-printer. that addon auto-places blocks from the
# schematic, which is a different thing entirely from previewing one - most
# servers treat it as cheating and it is not something to ship to everyone by
# default. litematica's own "easy place" mode is a softer version of the same
# question and is worth a house ruling, the way minimaps already have one.
MODS_BUILD = [
    ("malilib",                  "0.29.3",                None),
    ("litematica",               "0.28.4",                None),
]

MODS_MAP = [
    ("xaeros-minimap",           "fabric-26.2-26.4.2",    None),
    ("xaeros-world-map",         "fabric-26.2-1.44.2",    None),
]

# shaderpacks. loader tag is "iris", not "fabric". referenced by url only -
# see the module docstring for why nothing here is bundled.
SHADERS = [
    ("makeup-ultra-fast-shaders", "9.5c",   "MakeUp-UltraFast-9.5c.zip"),
    ("complementary-reimagined",  "r5.8.1", "ComplementaryReimagined_r5.8.1.zip"),
    ("sildurs-vibrant-shaders",   "2.01",   "Sildur's Vibrant Shaders v2.01 Extreme-VL.zip"),
]

# resource packs. loader tag is "minecraft" (modrinth's tag for a plain
# resourcepack project), dest is resourcepacks/. referenced by url only, same as
# the shaders - fresh animations is restrictively licensed and whimscape is ARR.
#
# FRESH ANIMATIONS + ITS SEVEN OFFICIAL ADDONS SHIP ENABLED, WHIMSCAPE SHIPS OFF.
# the enabled set is the `resourcePacks:` line in
# overrides/config/defaultoptions/options.txt, which default-options only
# applies when the player has no options.txt yet, so this is a first-run default
# and never a re-imposed one.
#
# ORDER IS LOAD-BEARING and README.md has the long version. short version:
# freshlx's own load-order diagram says any combination of addons, always listed
# ABOVE the fresh animations base. in options.txt later == higher, so base goes
# first and the addons follow it. whimscape ships its own optifine/cem entity
# models and would beat fresh animations if a player stacks it on top.
#
# NOT shipped: `fresh-animations-extensions` (FA+All_Extensions). it is a bundle
# of the six standalone addons below plus classic-horses, so shipping it too
# would stack two copies of the same content at different versions.
RESOURCEPACKS = [
    ("fresh-animations",          "1.10.5",       "FreshAnimations_v1.10.5.zip"),  # ALLOW_BETA
    # the addons. all release, all list 26.2, no beta exceptions needed.
    ("fresh-animations-details",  "2.3.0",        "FA+Details-v2.3.zip"),
    ("fresh-animations-objects",  "2.1.2",        "FA+Objects-v2.1.2.zip"),
    ("fresh-animations-emissive", "1.6.0",        "FA+Emissive-v1.6.zip"),
    ("fresh-animations-spiders",  "2.2.0",        "FA+Spiders-v2.2.zip"),
    ("fresh-animations-creepers", "2.1.0",        "FA+Creepers-v2.1.zip"),
    ("fresh-animations-quivers",  "2.2.0",        "FA+Quivers-v2.2.zip"),
    ("fa-player-extension",       "1.1.0",        "FA+Player-v1.1.zip"),
    # shipped present, NOT in the resourcePacks line. the player turns it on.
    ("whimscape",                 "26.1-26.2_r1", "Whimscape_26.1-26.2_r1.zip"),
]

MODS = MODS_CORE + MODS_PERF + MODS_VISUAL + MODS_AUDIO + MODS_QOL + MODS_BUILD + MODS_MAP
UA = {"User-Agent": "hearth-pack-builder/1.1 (cinderworks.dev)"}


def api(path):
    req = urllib.request.Request("https://api.modrinth.com/v2" + path, headers=UA)
    return json.load(urllib.request.urlopen(req))


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers=UA)
    with urllib.request.urlopen(req) as r:
        return r.status, int(r.headers.get("Content-Length") or -1)


# ---- resolve cache -----------------------------------------------------------------
# resolve-cache.json, next to this script: {"cache_version": N, "mc": "26.2", "entries": {key: {...}}}
# each record holds the finished (entry, meta) pair, so a hit needs no API calls at all -
# slug, version, type, date, path, url, sha512, fileSize all come straight back out of it
# and pack-report.json comes out with the same shape either way.

def cache_key(slug, pin, want_file, dest):
    """identity of one MODS/SHADERS/RESOURCEPACKS entry, or None if it must NOT be cached.

    pin=None means "whatever is newest release right now" - a moving target by design,
    so (same reasoning as a `-` pin in the foundry's manifest.txt) it is deliberately
    never cached: caching it would silently freeze the pack at whatever was newest the
    day the cache was written.
    """
    if pin is None:
        return None
    return f"{dest}|{slug}|{pin}|{want_file or '-'}"


def load_cache():
    try:
        blob = json.load(open(CACHE_FILE))
    except (OSError, ValueError):
        return {}
    # a schema bump or an mc version change invalidates the lot; both change what
    # "resolved" even means.
    if blob.get("cache_version") != CACHE_VERSION or blob.get("mc") != MC:
        return {}
    entries = blob.get("entries")
    return entries if isinstance(entries, dict) else {}


def save_cache(entries):
    tmp = CACHE_FILE + ".tmp"
    with open(tmp, "w") as fh:
        json.dump({"cache_version": CACHE_VERSION, "mc": MC, "entries": entries}, fh, indent=1)
    os.replace(tmp, CACHE_FILE)


def cache_lookup(cache, key, slug):
    """(entry, meta) for a usable cached record, else None -> resolve live."""
    rec = cache.get(key)
    if not isinstance(rec, dict):
        return None
    entry, meta = rec.get("entry"), rec.get("meta")
    if not isinstance(entry, dict) or not isinstance(meta, dict):
        return None
    # ALLOW_BETA is policy, not network: re-check it against the cached version_type so
    # that dropping a slug out of ALLOW_BETA still fails the build instead of sailing
    # through on a stale hit. a miss here falls into resolve(), which prints the FATAL.
    if meta.get("type") != "release" and slug not in ALLOW_BETA:
        return None
    return entry, meta


def _age_days(iso_ts):
    """age of an "%Y-%m-%dT%H:%M:%SZ" timestamp in days, or None if missing/unparsable."""
    if not iso_ts:
        return None
    try:
        t = time.strptime(iso_ts, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None
    return (time.time() - calendar.timegm(t)) / 86400


def verify_head_cached(rec, entry, slug):
    """cheap existence check on a cache hit: skip API lookups, but the download itself
    still gets checked - the cached content-length is trusted for HEAD_RECHECK_DAYS, then
    re-HEAD'd live and the timestamp refreshed. mutates rec in place so the caller's
    save_cache() picks up the refresh. dies FATAL exactly like a live resolve() would on
    a moved/broken download. returns True if a live HEAD ran, False if it was skipped."""
    if (_age_days(rec.get("head_checked_at")) or HEAD_RECHECK_DAYS + 1) < HEAD_RECHECK_DAYS:
        return False
    url = entry["downloads"][0]
    try:
        status, clen = head(url)
    except urllib.error.HTTPError as e:
        sys.exit(f"FATAL: {slug} (cached) HEAD {url} -> {e.code}")
    if status != 200:
        sys.exit(f"FATAL: {slug} (cached) HEAD {url} -> {status}")
    if clen != entry["fileSize"]:
        sys.exit(f"FATAL: {slug} (cached) size mismatch: cache {entry['fileSize']} vs HEAD {clen}")
    rec["head_checked_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return True


def resolve(slug, pin, want_file, loader, dest):
    vs = api(f"/project/{slug}/version"
             f"?loaders=%5B%22{loader}%22%5D&game_versions=%5B%22{MC}%22%5D")
    if not vs:
        sys.exit(f"FATAL: {slug} has no {MC}/{loader} build")

    cands = [v for v in vs if v["version_number"] == pin] if pin else list(vs)
    if pin and not cands:
        sys.exit(f"FATAL: {slug} pinned {pin} no longer resolves")

    chosen = f = None
    if want_file:
        for v in cands:
            for x in v["files"]:
                if x["filename"] == want_file:
                    chosen, f = v, x
                    break
            if chosen:
                break
        if chosen is None:
            sys.exit(f"FATAL: {slug} {pin} no longer ships file {want_file!r}")
    else:
        rel = [v for v in cands if v["version_type"] == "release"] or cands
        chosen = sorted(rel, key=lambda v: v["date_published"], reverse=True)[0]
        f = next((x for x in chosen["files"] if x.get("primary")), chosen["files"][0])

    # ---- the assertions. anything that trips one of these is dropped, never forced.
    if chosen["version_type"] != "release" and slug not in ALLOW_BETA:
        sys.exit(f"FATAL: {slug} {chosen['version_number']} is "
                 f"{chosen['version_type']}, not release")
    if MC not in chosen["game_versions"]:
        sys.exit(f"FATAL: {slug} {chosen['version_number']} does not list {MC}")
    if loader not in chosen["loaders"]:
        sys.exit(f"FATAL: {slug} {chosen['version_number']} does not list loader {loader}")
    if not f["url"].startswith("https://cdn.modrinth.com/"):
        sys.exit(f"FATAL: {slug} file is not modrinth-hosted: {f['url']}")
    for h in ("sha1", "sha512"):
        if not f["hashes"].get(h):
            sys.exit(f"FATAL: {slug} {f['filename']} has no {h}")
    try:
        status, clen = head(f["url"])
    except urllib.error.HTTPError as e:
        sys.exit(f"FATAL: {slug} HEAD {f['url']} -> {e.code}")
    if status != 200:
        sys.exit(f"FATAL: {slug} HEAD {f['url']} -> {status}")
    if clen != f["size"]:
        sys.exit(f"FATAL: {slug} size mismatch: api {f['size']} vs HEAD {clen}")

    entry = {
        "path": f"{dest}/{f['filename']}",
        "hashes": {"sha1": f["hashes"]["sha1"], "sha512": f["hashes"]["sha512"]},
        "env": {"client": "required", "server": "unsupported"},
        "downloads": [f["url"]],
        "fileSize": f["size"],
    }
    meta = {
        "slug": slug, "version": chosen["version_number"], "type": chosen["version_type"],
        "date": chosen["date_published"][:10], "path": entry["path"], "url": f["url"],
        "sha512": f["hashes"]["sha512"], "fileSize": f["size"], "pinned": pin is not None,
    }
    return entry, meta


def selftest():
    """offline check of the cache round trip. no network, no build, real files untouched."""
    global CACHE_FILE, head
    real_cache_file, real_head = CACHE_FILE, head
    tmp = tempfile.mkdtemp(prefix="hearth-cache-selftest-")
    CACHE_FILE = os.path.join(tmp, "resolve-cache.json")
    ok = []

    def check(name, cond):
        ok.append(cond)
        print(f"  {'ok  ' if cond else 'FAIL'} {name}")

    try:
        # what is and is not cacheable
        check("pinned entry is cacheable",
              cache_key("jei", "30.25.0.177", None, "mods") == "mods|jei|30.25.0.177|-")
        check("pin=None (newest) is NOT cacheable", cache_key("placeholder-api", None, None, "mods") is None)
        check("want_file is part of the key",
              cache_key("x", "1", "a.jar", "mods") != cache_key("x", "1", "b.jar", "mods"))
        check("dest is part of the key",
              cache_key("x", "1", None, "mods") != cache_key("x", "1", None, "shaderpacks"))

        # round trip
        entry = {"path": "mods/fake-1.0.jar", "hashes": {"sha1": "aa", "sha512": "bb"},
                 "env": {"client": "required", "server": "unsupported"},
                 "downloads": ["https://cdn.modrinth.com/data/X/versions/Y/fake-1.0.jar"], "fileSize": 123}
        meta = {"slug": "fake", "version": "1.0", "type": "release", "date": "2026-08-30",
                "path": entry["path"], "url": entry["downloads"][0], "sha512": "bb",
                "fileSize": 123, "pinned": True}
        key = cache_key("fake", "1.0", None, "mods")
        save_cache({key: {"entry": entry, "meta": meta, "cached_at": "2026-08-30T00:00:00Z"}})
        cache = load_cache()
        hit = cache_lookup(cache, key, "fake")
        check("write -> read round trips", hit is not None and hit[0] == entry and hit[1] == meta)
        check("report meta survives json intact", json.loads(json.dumps(hit[1])) == meta)
        check("miss on an unknown key", cache_lookup(cache, "mods|nope|1|-", "nope") is None)

        # invalidation paths
        blob = json.load(open(CACHE_FILE))
        blob["mc"] = "1.20.1"
        json.dump(blob, open(CACHE_FILE, "w"))
        check("an mc change invalidates the whole cache", load_cache() == {})
        blob["mc"], blob["cache_version"] = MC, CACHE_VERSION + 99
        json.dump(blob, open(CACHE_FILE, "w"))
        check("a cache_version bump invalidates the whole cache", load_cache() == {})
        os.remove(CACHE_FILE)
        check("a missing cache file is an empty cache, not a crash", load_cache() == {})
        open(CACHE_FILE, "w").write("{ not json")
        check("a corrupt cache file is an empty cache, not a crash", load_cache() == {})

        # policy re-checks on a hit
        beta = dict(meta, type="beta")
        c2 = {key: {"entry": entry, "meta": beta}}
        check("a cached beta not in ALLOW_BETA misses (so resolve() can FATAL)",
              cache_lookup(c2, key, "fake") is None)
        jkey = cache_key("jei", "1", None, "mods")
        check("a cached beta that IS in ALLOW_BETA hits",
              cache_lookup({jkey: {"entry": entry, "meta": beta}}, jkey, "jei") is not None)

        # HEAD-recheck semantics: cheap on a hit, but not free forever
        def boom(url):
            raise AssertionError("head() called on a fresh (< 7d) cache entry")
        rec_fresh = {"entry": entry, "meta": meta,
                     "head_checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        head = boom
        check("a fresh head_checked_at (< 7d) skips the live HEAD",
              verify_head_cached(rec_fresh, entry, "fake") is False)

        stale_ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 8 * 86400))
        rec_stale = {"entry": entry, "meta": meta, "head_checked_at": stale_ts}
        head = lambda url: (200, entry["fileSize"])
        did_recheck = verify_head_cached(rec_stale, entry, "fake")
        check("a stale head_checked_at (> 7d) re-HEADs live", did_recheck is True)
        check("a successful re-HEAD refreshes head_checked_at", rec_stale["head_checked_at"] != stale_ts)

        rec_missing = {"entry": entry, "meta": meta}
        head = lambda url: (200, entry["fileSize"])
        check("no head_checked_at at all forces a re-HEAD too",
              verify_head_cached(rec_missing, entry, "fake") is True)

        rec_bad = {"entry": entry, "meta": meta, "head_checked_at": stale_ts}
        head = lambda url: (200, entry["fileSize"] + 1)
        try:
            verify_head_cached(rec_bad, entry, "fake")
            check("a re-HEAD content-length mismatch is FATAL", False)
        except SystemExit:
            check("a re-HEAD content-length mismatch is FATAL", True)
    finally:
        CACHE_FILE, head = real_cache_file, real_head
        for name in sorted(os.listdir(tmp)):
            os.remove(os.path.join(tmp, name))
        os.rmdir(tmp)

    print(f"\n{sum(ok)}/{len(ok)} passed")
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description="build the hearth client pack from the entry lists above")
    ap.add_argument("--refresh", nargs="*", metavar="SLUG",
                    help="bare: ignore resolve-cache.json and re-resolve every entry live. "
                         "with one or more SLUGs: bust only the cached lines whose identity contains "
                         "that text, case-insensitive (slug, pin, filename or dest), and take the rest "
                         "from cache.")
    ap.add_argument("--selftest", action="store_true",
                    help="exercise the resolve cache against fake entries in a temp dir; no network, no build.")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()

    refresh_all = args.refresh == []
    refresh_slugs = [s.lower() for s in (args.refresh or [])]

    cache = {} if refresh_all else load_cache()
    if refresh_slugs:
        busted = [k for k in cache if any(s in k.lower() for s in refresh_slugs)]
        for k in busted:
            del cache[k]
        print(f"--refresh: busted {len(busted)} cached entr{'y' if len(busted) == 1 else 'ies'} "
              f"matching {', '.join(refresh_slugs)}")

    files, report, seen = [], [], set()
    n_cached = n_live = 0
    try:
        for group, loader, dest in ((MODS, "fabric", "mods"),
                                    (SHADERS, "iris", "shaderpacks"),
                                    (RESOURCEPACKS, "minecraft", "resourcepacks")):
            for slug, pin, want_file in group:
                key = cache_key(slug, pin, want_file, dest)
                rec = cache.get(key) if key else None
                hit = cache_lookup(cache, key, slug) if key else None
                if hit:
                    entry, meta = hit
                    verify_head_cached(rec, entry, slug)  # cheap, mutates rec in place
                    n_cached += 1
                else:
                    entry, meta = resolve(slug, pin, want_file, loader, dest)
                    n_live += 1
                    if key:
                        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                        cache[key] = {"entry": entry, "meta": meta, "cached_at": now, "head_checked_at": now}
                if key:
                    seen.add(key)
                files.append(entry)
                report.append(meta)
                print(f"  {slug:26} {meta['version']:28} {meta['date']}  {dest}"
                      f"{'  (cached)' if hit else ''}")
                if not hit:
                    time.sleep(0.4)  # be polite; only ever paid on a live resolve.
        # only prune once every line resolved - a build that died halfway keeps what it had.
        cache = {k: v for k, v in cache.items() if k in seen}
    finally:
        # save even on a FATAL: a rate-limit failure partway keeps what already resolved.
        save_cache(cache)

    print(f"\nresolved {n_cached} from cache, {n_live} live")

    paths = [x["path"] for x in files]
    if len(set(paths)) != len(paths):
        sys.exit("FATAL: duplicate paths in index")

    index = {
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": PACK_VERSION,
        "name": PACK_NAME,
        "summary": ("optional client-side mods, shaderpacks and resource packs for "
                    "the hearth (mc 26.2, fabric). performance, visuals, qol. java "
                    "only. shaderpacks: MakeUp - Ultra Fast by Lorenzo Dal Vit, "
                    "Complementary Shaders - Reimagined by EminGT, "
                    "Sildur's Vibrant Shaders by Sildur. resource packs: "
                    "Fresh Animations and its official addons by FreshLX (on by "
                    "default), Whimscape by kavast (shipped off) - each downloaded "
                    "from the author's own modrinth upload, none redistributed here."),
        "files": files,
        "dependencies": {"minecraft": MC, "fabric-loader": FABRIC_LOADER},
    }

    OVERRIDES = os.path.join(HERE, "overrides")

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("modrinth.index.json", json.dumps(index, indent=2))
        # our own files only - see the module docstring
        shipped = []
        for root, _dirs, names in os.walk(OVERRIDES):
            for name in sorted(names):
                if name == ".DS_Store":
                    continue
                full = os.path.join(root, name)
                rel = os.path.relpath(full, OVERRIDES)
                z.write(full, os.path.join("overrides", rel))
                shipped.append(rel)

    print("\nwrote", OUT, os.path.getsize(OUT), "bytes")
    print("overrides:", ", ".join(shipped) if shipped else "(none)")
    print("files:", len(files),
          f"({sum(1 for p in paths if p.startswith('mods/'))} mods, "
          f"{sum(1 for p in paths if p.startswith('shaderpacks/'))} shaderpacks, "
          f"{sum(1 for p in paths if p.startswith('resourcepacks/'))} resourcepacks)")
    json.dump([[m["slug"], m["version"], m["date"], m["path"]] for m in report],
              open("/tmp/hearth-work/pack-report.json", "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
