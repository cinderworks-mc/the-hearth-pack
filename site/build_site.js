#!/usr/bin/env node
'use strict';

// the hearth client pack's download page. one static page, built off what is
// already in this repo:
//
//   client-pack/site/build/index.html                          the page
//   client-pack/site/build/downloads/hearth-client-<mc>-<ver>.mrpack   the pack itself
//
// the stylesheet is NOT built here: the page links the current hashed asset
// at the site root, which the cinderworks-web hub repo deploys. same origin,
// one shared css layer across every cinderworks.dev page.
//
// inputs, all local, no network:
//   client-pack/*.mrpack   newest by version -> version, size, sha256
//   build_mrpack.py        MC / FABRIC_LOADER / PACK_VERSION plus the manifest
//                          lists, so the mod / shader / resource pack counts
//                          are read out of the list rather than typed twice
//   README.md              selected current-release summary lines, kept
//                          verbatim. the complete history lives on github.
//
// this is the foundry's site/build_site.js generalized. same structure, same
// conventions - the page-local prefix is `hp-` here where the foundry uses
// `fp-`, because the shared stylesheet owns a set of bare class names and two
// pages that ship different local rules under the same prefix would be a
// landmine the first time anyone copies markup between them.
//
// THE COPY IS THE POINT. the foundry's pack is mandatory - an out of date pack
// there will not connect. the hearth's is not: the server runs a vanilla-client
// rule, so a plain client joins and so does bedrock. every section leads with
// that instead of burying it, and the page never implies otherwise.
//
// zero deps, node builtins only. the page makes NO external requests: the
// stylesheet, the favicon and the .mrpack are all same-origin, there is no
// script, no font fetch, no analytics. checkable with `grep -o 'https\?://'`
// over build/index.html - the only absolute urls are ones a human clicks.
//
// COLOR. only cinderworks.css tokens, the ember den. grounds night -> den,
// pencil for every border, cream/tallow/smoke for text, flame the one accent.
// no glow anywhere, and the modrinth button is the one bevel on the page.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PACK = path.resolve(__dirname, '..');
// 10-02-2026: this generator moved here from calcifer/client-pack/site. the pack
// repo is now the repo root, and it sits at the same depth the old calcifer root
// did (calcifer-stack/<repo>), so the ../../hearth-stack paths below still hold.
const REPO_ROOT = PACK;
// From this repo root, ../../hearth-stack reaches the sibling hub checkout.
// The estate-plan draft's ../../../ form resolves to ~/Documents/hearth-stack
// here, one directory too high.
const DEFAULT_FACTS_PATH = path.resolve(REPO_ROOT,
  '..', '..', 'hearth-stack', 'cinderworks-web', 'public', 'facts.json');
const DEFAULT_CSS_MANIFEST_PATH = path.resolve(REPO_ROOT,
  '..', '..', 'hearth-stack', 'cinderworks-web', 'public', 'css-manifest.json');

const CONFIG = {
  packDir: PACK,
  buildScript: path.join(PACK, 'build_mrpack.py'),
  readme: path.join(PACK, 'README.md'),
  outDir: path.join(__dirname, 'build'),
  factsPath: process.env.CINDERWORKS_FACTS_PATH || DEFAULT_FACTS_PATH,
  cssManifestPath: process.env.CINDERWORKS_CSS_MANIFEST_PATH || DEFAULT_CSS_MANIFEST_PATH,

  appUrl: 'https://modrinth.com/app',
  modrinthPage: 'https://modrinth.com/modpack/the-hearth-pack',
  serverPage: 'https://cinderworks.dev/hearth/',
  foundryPage: 'https://cinderworks.dev/foundry/pack',
  // not documented anywhere in the pack - this is a recommendation, not a
  // constant read out of a file. 81 client mods plus shaders wants headroom.
  ramGb: 4,
};

// Keep this short and player-facing. These lines come verbatim from the
// current release section in the pack README. The site deliberately does not
// render prior-release detail or technical implementation notes.
const RELEASES = Object.freeze({
  // DRAFT 10-02-2026 - covers 2.2.0 through 2.2.3 for anyone coming from the old
  // 2.1.0 page. patrick's voice, needs his strike-pass before the page is deployed.
  '2.2.3': Object.freeze({
    player_summary: Object.freeze([
      'armored elytras are a real mod now: put a chestplate and an elytra in an anvil to fuse them, split them back in a grindstone. the pack ships the client half so a fused elytra actually looks like one.',
      'distant horizons moves to the 3.3.2 release line on both halves, with about half the disk work. your lod database migrates itself on first launch, give it a moment.',
      'the usual bumps: sodium 0.9.2 with iris 1.11.4, both complementary shaders on r5.9.3, fabric api 0.161.0, plus discord rich presence. coming from 2.1.x you get all of 2.2 at once, so re-import the pack.',
    ]),
    compat_warning: 'this pack is optional. any pack version works. no pack works too. the server accepts a vanilla java client. bedrock joins with no pack.',
  }),
  '2.1.0': Object.freeze({
    player_summary: Object.freeze([
      'the shaders now match the foundry: makeup ultra fast, complementary reimagined and unbound both on r5.9, with euphoria patches 1.10.0 (adds the end black hole and nebula). sildur\'s was dropped.',
      'distant horizons rides along now but shipped off, exactly like the foundry - turn it on in options, distant horizons, enable rendering. the 26.2 build is beta, same as the foundry ships.',
      'default dark mode added (a gui dark theme, off by default), plus three routine bug-fix bumps: fabric api, lambdynamiclights (options.txt keybind fix), and entity texture features (crash fix).',
    ]),
    compat_warning: 'this pack is optional. any pack version works. no pack works too. the server accepts a vanilla java client. bedrock joins with no pack.',
  }),
  '2.0.1': Object.freeze({
    player_summary: Object.freeze([
      'icon only. no mods, no resource packs, no config changes, nothing that touches how the game plays or performs.',
      'the multiplayer entry the pack pre-adds carries the hearth\'s campfire, so it shows up in your server list looking like itself from the moment you install, instead of the grey unknown-server tile you get until your first successful ping. same art as the modrinth page and the discord card.',
      'if you already have the hearth in your list, default-options leaves your existing servers.dat alone (that is the whole point of it) - so this only shows up on a fresh install. re-importing is optional and changes nothing else.',
    ]),
    compat_warning: 'this pack is optional. any pack version works. no pack works too. the server accepts a vanilla java client. bedrock joins with no pack.',
  }),
});

const FULL_HISTORY_URL = 'https://github.com/cinderworks-mc/the-hearth-pack/blob/main/CHANGELOG.md';

// Mid-rollout only. The mac build normally reads the hub checkout above;
// retain today's values so a missing checkout cannot stop a pack release.
const FALLBACK_HEARTH_FACTS = Object.freeze({
  java_host: 'vanilla.cinderworks.dev', java_port: 25565,
  bedrock_host: 'vanilla.cinderworks.dev', bedrock_port: 19132,
  mc_version: '26.2', loader: 'fabric', loader_version: '0.19.3',
  pack_required: 'optional', pack_version: '2.1.0',
  pack_url: 'https://cinderworks.dev/hearth/pack/',
  join_summary: 'the whitelist is self-service: run /link with your minecraft name in discord and you\'re in.',
});

function validHearthFacts(server) {
  return server && typeof server === 'object'
    && ['java_host', 'bedrock_host', 'mc_version', 'loader',
      'pack_required', 'pack_version', 'pack_url', 'join_summary']
      .every((key) => typeof server[key] === 'string' && server[key])
    && typeof server.loader_version === 'string'
    && Number.isInteger(server.java_port) && Number.isInteger(server.bedrock_port)
    && ['required', 'optional', 'none'].includes(server.pack_required);
}

function loadHearthFacts(factsPath = CONFIG.factsPath, warn = console.error) {
  let facts = null;
  try { facts = JSON.parse(fs.readFileSync(factsPath, 'utf8')); } catch { /* warning below */ }
  const server = facts && facts.servers && facts.servers.hearth;
  if (validHearthFacts(server)) return server;
  warn(`FACTS WARNING: ${factsPath} is missing or invalid; using built-in hearth values until the hub checkout is available`);
  return FALLBACK_HEARTH_FACTS;
}

function stylesheetHref(manifestPath = CONFIG.cssManifestPath, warn = console.error) {
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* warning below */ }
  const file = manifest && manifest.current && manifest.current.file;
  if (typeof file === 'string' && /^cinderworks\.[a-f0-9]+\.css$/i.test(file)) return `/${file}`;
  warn(`CSS WARNING: ${manifestPath} is missing or invalid; using /cinderworks.css until the hub checkout is available`);
  return '/cinderworks.css';
}

function packRequirementLabel(packRequired) {
  if (packRequired === 'required') return 'required pack';
  if (packRequired === 'none') return 'no pack required';
  return 'optional pack, or a plain client';
}

function loaderLabel(server) {
  return [server.loader, server.loader_version].filter(Boolean).join(' ');
}

// --------------------------------------------------------------------- escape

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// the README is markdown and it is prose, not a bullet list of slugs. escape
// first, then put back the two inline markers it actually uses: **bold** and
// `code`. nothing else - no links, no images, no html passthrough, so a README
// edit can never inject markup into the page.
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// --------------------------------------------------------------------- format

// mm-dd-yyyy everywhere a date shows, per house style.
function fmtDate(v) {
  if (typeof v === 'string') {
    const [y, m, d] = v.split('-');
    return `${m}-${d}-${y}`;
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${p(v.getMonth() + 1)}-${p(v.getDate())}-${v.getFullYear()}`;
}

function fmtDateTime(d) {
  let h = d.getHours();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${fmtDate(d)} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

function fmtSize(bytes) {
  return bytes < 1048576
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
}

// ------------------------------------------------------------------- versions

// "1.10.1" -> [[1,''],[10,''],[1,'']]. compares numerically part by part so
// 1.10.1 beats 1.9.0, which a plain string sort gets wrong.
function verKey(v) {
  return v.split(/[.-]/).map((p) => {
    const m = /^(\d+)(.*)$/.exec(p);
    return m ? [Number(m[1]), m[2]] : [-1, p];
  });
}

function cmpVersion(a, b) {
  const x = verKey(a);
  const y = verKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] || [-1, ''];
    const q = y[i] || [-1, ''];
    if (p[0] !== q[0]) return p[0] - q[0];
    if (p[1] !== q[1]) return p[1] < q[1] ? -1 : 1;
  }
  return 0;
}

// --------------------------------------------------------------------- inputs

// MC, FABRIC_LOADER and PACK_VERSION live in build_mrpack.py. reading them out
// instead of copying them keeps one source of truth.
function readLoader() {
  const src = fs.readFileSync(CONFIG.buildScript, 'utf8');
  const grab = (name) => {
    const m = new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm').exec(src);
    if (!m) throw new Error(`could not read ${name} out of ${CONFIG.buildScript}`);
    return m[1];
  };
  return { mc: grab('MC'), fabric: grab('FABRIC_LOADER'), packVersion: grab('PACK_VERSION') };
}

// the manifest is python lists of `(slug, pin, filename)` tuples. count the
// tuple heads inside each list rather than trying to parse python: the counts
// are what the page shows, and a miscount is visible against the README's own
// "N entries" line.
function readManifest() {
  const src = fs.readFileSync(CONFIG.buildScript, 'utf8');
  const listLen = (name) => {
    const m = new RegExp(`^${name}\\s*=\\s*\\[([\\s\\S]*?)^\\]`, 'm').exec(src);
    if (!m) throw new Error(`could not read the ${name} list out of ${CONFIG.buildScript}`);
    return (m[1].match(/^\s*\("/gm) || []).length;
  };
  const modLists = ['MODS_CORE', 'MODS_PERF', 'MODS_VISUAL', 'MODS_AUDIO',
    'MODS_QOL', 'MODS_BUILD', 'MODS_MAP'];
  const mods = modLists.reduce((n, name) => n + listLen(name), 0);
  const shaders = listLen('SHADERS');
  const resourcepacks = listLen('RESOURCEPACKS');
  return { mods, shaders, resourcepacks, total: mods + shaders + resourcepacks };
}

// modrinth slugs read out of build_mrpack.py carry no display name of their
// own, and this script makes no network calls (see the module docstring), so
// the ones anybody would recognize are hardcoded here. everything else falls
// back to a plain hyphen -> title case pass in humanize().
const MOD_TITLES = {
  'fabric-api': 'Fabric API', 'cloth-config': 'Cloth Config', 'placeholder-api': 'Placeholder API',
  yacl: 'YACL', 'fabric-language-kotlin': 'Fabric Language: Kotlin', searchables: 'Searchables',
  tcdcommons: 'TCD Commons', 'prism-lib': 'Prism Lib', iceberg: 'Iceberg', balm: 'Balm',
  'default-options': 'Default Options', creativecore: 'CreativeCore',
  'supermartijn642s-config-lib': "SuperMartijn642's Config Lib",

  sodium: 'Sodium', lithium: 'Lithium', 'sodium-extra': 'Sodium Extra',
  'reeses-sodium-options': "Reese's Sodium Options", immediatelyfast: 'ImmediatelyFast',
  'ferrite-core': 'FerriteCore', moreculling: 'More Culling', 'dynamic-fps': 'Dynamic FPS',
  entityculling: 'EntityCulling', bobby: 'Bobby', krypton: 'Krypton',
  'language-reload': 'Language Reload', ixeris: 'Ixeris', 'modernfix-mvus': 'ModernFix (MVUS)',
  scalablelux: 'ScalableLux', 'cubes-without-borders': 'Cubes Without Borders',

  iris: 'Iris', continuity: 'Continuity', '3dskinlayers': '3D Skin Layers', capes: 'Capes',
  lambdynamiclights: 'LambDynamicLights', 'not-enough-animations': 'Not Enough Animations',
  'chat-heads': 'Chat Heads', entitytexturefeatures: 'Entity Texture Features',
  'entity-model-features': 'Entity Model Features', optigui: 'OptiGUI',
  'euphoria-patches': 'Euphoria Patches', fallingleaves: 'FallingLeaves',
  'wavey-capes': 'Wavey Capes', 'particle-rain': 'Particle Rain', visuality: 'Visuality',
  puzzle: 'Puzzle', 'better-block-entities': 'Better Block Entities',
  animaticarefabricated: 'Animatica',

  'sound-physics-remastered': 'Sound Physics Remastered', ambientsounds: 'AmbientSounds',
  'presence-footsteps': 'Presence Footsteps',

  modmenu: 'Mod Menu', jade: 'Jade', appleskin: 'AppleSkin', jei: 'JEI',
  controlling: 'Controlling', betterf3: 'BetterF3', 'legendary-tooltips': 'Legendary Tooltips',
  'mouse-tweaks': 'Mouse Tweaks', zoomify: 'Zoomify', 'better-stats': 'Better Stats',
  debugify: 'Debugify', 'simple-voice-chat': 'Simple Voice Chat',
  shulkerboxtooltip: 'ShulkerBoxTooltip', morechathistory: 'More Chat History',
  fadeless: 'Fadeless', lighty: 'Lighty', stendhal: 'Stendhal',
  'no-chat-reports': 'No Chat Reports', 'in-game-account-switcher': 'In-Game Account Switcher',
  essential: 'Essential', 'essential-patcher': 'Essential Patcher',
  notenoughcrashes: 'Not Enough Crashes', 'status-effect-bars': 'Status Effect Bars',
  'item-highlighter': 'Item Highlighter', 'durability-tooltip': 'Durability Tooltip',
  'armor-hud': 'Armor HUD', 'crash-assistant': 'Crash Assistant',

  malilib: 'MaLiLib', litematica: 'Litematica',

  'xaeros-minimap': "Xaero's Minimap", 'xaeros-world-map': "Xaero's World Map",

  'makeup-ultra-fast-shaders': 'MakeUp: Ultra Fast Shaders',
  'complementary-reimagined': 'Complementary Reimagined',
  'sildurs-vibrant-shaders': "Sildur's Vibrant Shaders",

  'fresh-animations': 'Fresh Animations', 'fresh-animations-details': 'FA+Details',
  'fresh-animations-objects': 'FA+Objects', 'fresh-animations-emissive': 'FA+Emissive',
  'fresh-animations-spiders': 'FA+Spiders', 'fresh-animations-creepers': 'FA+Creepers',
  'fresh-animations-quivers': 'FA+Quivers', 'fa-player-extension': 'FA+Player',
  whimscape: 'Whimscape',
};

function humanize(slug) {
  if (MOD_TITLES[slug]) return MOD_TITLES[slug];
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// same tuple lists readManifest() counts, but keeping every slug in order
// instead of collapsing it to a number - this is what the "what is in it"
// section lists out, one block per group, in the order the page shows them.
function readManifestGroups() {
  const src = fs.readFileSync(CONFIG.buildScript, 'utf8');
  const listSlugs = (name) => {
    const m = new RegExp(`^${name}\\s*=\\s*\\[([\\s\\S]*?)^\\]`, 'm').exec(src);
    if (!m) throw new Error(`could not read the ${name} list out of ${CONFIG.buildScript}`);
    return [...m[1].matchAll(/^\s*\(\s*"([^"]+)"/gm)].map((x) => x[1]);
  };
  return [
    ['performance', listSlugs('MODS_PERF')],
    ['visual', listSlugs('MODS_VISUAL')],
    ['audio', listSlugs('MODS_AUDIO')],
    ['qol', listSlugs('MODS_QOL')],
    ['building', listSlugs('MODS_BUILD')],
    ['maps', listSlugs('MODS_MAP')],
    ['libraries', listSlugs('MODS_CORE')],
    ['shaders', listSlugs('SHADERS')],
    ['resource packs', listSlugs('RESOURCEPACKS')],
  ];
}

// overrides/ is our own files - the only thing in the pack that is actually
// shipped rather than referenced. counted off disk, since that is the honest
// number and there is no list of them anywhere.
function readOverrides() {
  const root = path.join(CONFIG.packDir, 'overrides');
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else out.push(path.relative(root, p));
    }
  };
  try { walk(root); } catch { return []; }
  return out.sort();
}

// newest .mrpack in client-pack/ by version, not by mtime: a rebuild of an
// older version would otherwise win.
function latestPack(mc) {
  const re = new RegExp(`^hearth-client-${mc.replace(/\./g, '\\.')}-(.+)\\.mrpack$`);
  const found = [];
  for (const name of fs.readdirSync(CONFIG.packDir)) {
    const m = re.exec(name);
    if (m) found.push({ name, version: m[1] });
  }
  if (!found.length) {
    throw new Error(`no hearth-client-${mc}-*.mrpack in ${CONFIG.packDir} - run build_mrpack.py first`);
  }
  found.sort((a, b) => cmpVersion(a.version, b.version));
  const pick = found[found.length - 1];
  const file = path.join(CONFIG.packDir, pick.name);
  const st = fs.statSync(file);
  return {
    ...pick,
    file,
    bytes: st.size,
    built: st.mtime,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    older: found.slice(0, -1).map((f) => f.version).reverse(),
  };
}

// the changelog is the README's own "## what <version> adds over <prev>"
// section. no separate CHANGELOG.md to keep in sync, because there is exactly
// one of these per release and it is already written.
//
// inside it, each `### sub` is an entry and the lines under it are its body.
// the markdown is hard-wrapped prose, so consecutive non-blank lines are joined
// back into one paragraph before rendering - otherwise every line break in the
// source becomes a visual break on the page.
function readChangelog(packVersion) {
  const src = fs.readFileSync(CONFIG.readme, 'utf8').split('\n');
  const head = new RegExp(`^##\\s+what\\s+${packVersion.replace(/\./g, '\\.')}\\s+adds\\b(.*)$`, 'i');

  let i = src.findIndex((l) => head.test(l));
  if (i < 0) return null;
  const title = head.exec(src[i])[0].replace(/^##\s+/, '');
  i++;

  const body = [];
  for (; i < src.length; i++) {
    if (/^##\s/.test(src[i])) break;   // next h2 ends the section
    body.push(src[i]);
  }

  // lede = everything before the first ###, entries = one per ###
  const lede = [];
  const entries = [];
  let cur = null;
  let block = null;   // the paragraph or bullet currently being accumulated

  const flush = () => {
    if (!block) return;
    (cur ? cur.body : lede).push({ kind: block.kind, text: block.parts.join(' ') });
    block = null;
  };

  for (const raw of body) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    const h3 = /^###\s+(.*\S)\s*$/.exec(line);
    if (h3) {
      flush();
      cur = { head: h3[1], body: [] };
      entries.push(cur);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      block = { kind: 'li', parts: [bullet[1]] };
      continue;
    }

    // a continuation of whatever is open, or the start of a new paragraph
    if (block) block.parts.push(line);
    else block = { kind: 'p', parts: [line] };
  }
  flush();

  return { title, lede, entries };
}

function releaseFor(packVersion) {
  const release = RELEASES[packVersion];
  if (!release || release.player_summary.length !== 3 || !release.compat_warning) {
    throw new Error(`no three-item player summary for pack ${packVersion}`);
  }
  return release;
}

// ---------------------------------------------------------------------- chrome

// the pixel flame mark from the design sheet, emitted once right after <body>
// and referenced from the banner via <use>. copied verbatim from the hub
// page's symbol so every cinderworks.dev page draws the exact same mark.
const FLAME_SYMBOL = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="flame" viewBox="0 0 10 13"><rect fill="var(--mk1)" x="5" y="0" width="1" height="1"/><rect fill="var(--mk1)" x="6" y="0" width="1" height="1"/><rect fill="var(--mk1)" x="4" y="1" width="1" height="1"/><rect fill="var(--mk2)" x="5" y="1" width="1" height="1"/><rect fill="var(--mk2)" x="6" y="1" width="1" height="1"/><rect fill="var(--mk1)" x="7" y="1" width="1" height="1"/><rect fill="var(--mk1)" x="4" y="2" width="1" height="1"/><rect fill="var(--mk2)" x="5" y="2" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="2" width="1" height="1"/><rect fill="var(--mk1)" x="7" y="2" width="1" height="1"/><rect fill="var(--mk1)" x="3" y="3" width="1" height="1"/><rect fill="var(--mk2)" x="4" y="3" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="3" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="3" width="1" height="1"/><rect fill="var(--mk1)" x="7" y="3" width="1" height="1"/><rect fill="var(--mk1)" x="3" y="4" width="1" height="1"/><rect fill="var(--mk2)" x="4" y="4" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="4" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="4" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="4" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="4" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="5" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="5" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="5" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="5" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="5" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="5" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="5" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="6" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="6" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="6" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="6" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="6" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="6" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="6" width="1" height="1"/><rect fill="var(--mk1)" x="1" y="7" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="7" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="7" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="7" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="7" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="7" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="7" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="7" width="1" height="1"/><rect fill="var(--mk1)" x="1" y="8" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="8" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="8" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="8" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="8" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="8" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="8" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="8" width="1" height="1"/><rect fill="var(--mk1)" x="9" y="8" width="1" height="1"/><rect fill="var(--mk1)" x="1" y="9" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="9" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="9" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="9" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="9" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="9" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="9" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="9" width="1" height="1"/><rect fill="var(--mk1)" x="9" y="9" width="1" height="1"/><rect fill="var(--mk1)" x="1" y="10" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="10" width="1" height="1"/><rect fill="var(--mk2)" x="3" y="10" width="1" height="1"/><rect fill="var(--mk3)" x="4" y="10" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="10" width="1" height="1"/><rect fill="var(--mk3)" x="6" y="10" width="1" height="1"/><rect fill="var(--mk2)" x="7" y="10" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="10" width="1" height="1"/><rect fill="var(--mk1)" x="2" y="11" width="1" height="1"/><rect fill="var(--mk1)" x="3" y="11" width="1" height="1"/><rect fill="var(--mk2)" x="4" y="11" width="1" height="1"/><rect fill="var(--mk3)" x="5" y="11" width="1" height="1"/><rect fill="var(--mk2)" x="6" y="11" width="1" height="1"/><rect fill="var(--mk1)" x="7" y="11" width="1" height="1"/><rect fill="var(--mk1)" x="8" y="11" width="1" height="1"/><rect fill="var(--mk1)" x="3" y="12" width="1" height="1"/><rect fill="var(--mk1)" x="4" y="12" width="1" height="1"/><rect fill="var(--mk1)" x="5" y="12" width="1" height="1"/><rect fill="var(--mk1)" x="6" y="12" width="1" height="1"/><rect fill="var(--mk1)" x="7" y="12" width="1" height="1"/></symbol></svg>';

// page-local styles only. tokens, type, links, the button bevel and the shared
// chrome (.page/.banner/.brand/.wordmark/.rev/.sec/.lbl/.rows/footer) come from
// /cinderworks.css untouched, deployed at the site root by the cinderworks-web
// repo. nothing here redefines a token or restyles a shared class. all
// page-local classes are hp- prefixed.
const CSS = `
.hp-lede{color:var(--tallow);font-size:14px;line-height:1.7;max-width:64ch;margin-top:14px}
.hp-lede b{color:var(--cream);font-weight:600}

/* the one line the whole page hangs off. it is a claim about what is required,
   so it gets the hero scale: monocraft 900, smoothing off, lowercase. */
.hp-optional{font:900 27px/1.25 var(--display);letter-spacing:.02em;color:var(--cream);
  margin-top:24px;-webkit-font-smoothing:none;font-smooth:never}

/* captions and asides. smoke, one step quieter than body copy. */
.hp-note{color:var(--smoke);font-size:12.5px;line-height:1.6;margin-top:14px;max-width:72ch}

/* the download card: den panel, pencil edge, the large frame radius. the
   button inside it is the shared .btn .btn-primary bevel from cinderworks.css,
   verbatim - the one bevel and the one hard shadow on the page. .hp-get only
   strips the anchor underline the shared \`a\` rule would add. */
.hp-grab{display:flex;flex-wrap:wrap;align-items:center;gap:14px 24px;
  border:1px solid var(--pencil);border-radius:var(--r);background:var(--den);
  padding:18px}
.hp-get{text-decoration:none}
.hp-recommended{color:var(--tallow);font-size:12.5px;line-height:1.55;max-width:32ch}
.hp-recommended b{color:var(--cream);font-weight:600}
.hp-manual{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:baseline;gap:5px 14px;
  border-top:1px solid var(--pencil);padding-top:14px}
.hp-manual-label{font:700 10.5px/1.6 var(--micro);letter-spacing:.13em;text-transform:uppercase;
  color:var(--smoke)}
.hp-manual a{color:var(--tallow);font-size:13px}
.hp-callout{flex:0 0 100%;border-left:2px solid var(--flame);padding:10px 0 0 14px;
  color:var(--tallow);font-size:12.5px;line-height:1.6}
.hp-callout b{color:var(--cream);font-weight:600}
.hp-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
.hp-file{font:500 13px/1.5 var(--mono);color:var(--cream);word-break:break-all}
.hp-facts{color:var(--smoke);font-size:12.5px;font-variant-numeric:tabular-nums}

/* spec rows. terms are micro caps in smoke, values are jetbrains mono -
   versions, hashes and addresses always render in the mono face. */
.hp-spec{display:grid;grid-template-columns:110px 1fr;gap:6px 14px;margin-top:16px}
.hp-spec dt{font:700 10.5px/1.7 var(--micro);letter-spacing:.13em;text-transform:uppercase;
  color:var(--smoke)}
.hp-spec dd{font:400 12.5px/1.7 var(--mono);color:var(--tallow);word-break:break-all;
  font-variant-numeric:tabular-nums}
.hp-spec dd b{color:var(--cream);font-weight:500}

/* the connect addresses. the one thing a player has to type, so each is a den
   panel of its own, jetbrains mono, bigger than body copy. */
.hp-addr{display:flex;align-items:baseline;gap:14px;border:1px solid var(--pencil);
  border-radius:var(--r);background:var(--den);padding:14px 18px;margin-bottom:10px;
  overflow-x:auto;white-space:nowrap;font:500 15px/1.4 var(--mono);color:var(--cream)}
.hp-addr .hp-side{font:700 10.5px/1 var(--micro);letter-spacing:.13em;
  text-transform:uppercase;color:var(--smoke);flex:none}
.hp-addr .hp-port{font:400 12.5px/1.4 var(--mono);color:var(--smoke)}

/* numbered steps. a real <ol> with the marker suppressed and redrawn as smoke
   micro figures, so the numbers read as structure and screen readers still get
   a list. minmax(0,1fr) on the text column, not 1fr - an implicit max-content
   track overflows the viewport on a phone. the step text MUST be wrapped in a
   single <span>: a grid container turns every child into a grid item, so bare
   <a>/<b> inside the li would each get their own column and the sentence comes
   apart. that bug shipped once on the foundry page and was caught in a render. */
.hp-steps{list-style:none;counter-reset:hpstep;display:flex;flex-direction:column;gap:12px}
.hp-steps li{counter-increment:hpstep;display:grid;grid-template-columns:24px minmax(0,1fr);
  gap:12px;align-items:baseline}
.hp-steps li::before{content:counter(hpstep) ".";font:700 12.5px/1 var(--micro);
  color:var(--smoke);font-variant-numeric:tabular-nums}
.hp-steps li > span{color:var(--tallow);font-size:14px;line-height:1.65;max-width:68ch}
.hp-steps b{color:var(--cream);font-weight:600}

/* the what's-new block. one sub-head per ### in the README, its paragraphs and
   bullets under it. group heads are grotesk micro caps, NOT monocraft - the
   display face never renders below 14px, and the shared sheet forces smoothing
   off on every h3, so it is forced back on for this grotesk run. */
.hp-new{display:flex;flex-direction:column;gap:18px}
.hp-group > h3{font:700 10.5px/1 var(--micro);letter-spacing:.13em;
  text-transform:uppercase;color:var(--smoke);margin-bottom:8px;
  -webkit-font-smoothing:antialiased;font-smooth:auto}
.hp-group p{color:var(--tallow);font-size:14px;line-height:1.65;max-width:72ch;
  margin-bottom:8px}
/* a paragraph straight after a bullet list reads as the last bullet's second
   half without this - the README does exactly that under "resource packs". */
.hp-group ul + p{margin-top:12px}
/* same grid trap as .hp-steps, and it bit here too on the first render: a grid
   container makes EVERY child a grid item, so the <b> runs inside a bullet each
   claimed their own column and the sentence came apart vertically. the bullet
   text is wrapped in one <span> and the styling hangs off li > span. */
.hp-group ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.hp-group li{display:grid;grid-template-columns:14px minmax(0,1fr);gap:8px;
  align-items:baseline}
.hp-group li > span{color:var(--tallow);font-size:14px;line-height:1.65;max-width:72ch}
.hp-group li::before{content:"-";color:var(--smoke);font-size:14px}
.hp-group b{color:var(--cream);font-weight:600}
.hp-group code{font-family:var(--mono);color:var(--cream);font-size:.92em}

.hp-summary{list-style:none;display:flex;flex-direction:column;gap:8px}
.hp-summary li{display:grid;grid-template-columns:14px minmax(0,1fr);gap:8px;align-items:baseline}
.hp-summary li > span{color:var(--tallow);font-size:14px;line-height:1.65;max-width:72ch}
.hp-summary li::before{content:"+";color:var(--smoke);font-size:14px}

/* the "what is in it" lists - one block per manifest group, a sub-label above
   a dense comma-separated run of names. plain text, not li/grid, so none of
   the grid-trap risk noted above applies here. */
.hp-contents{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.hp-cgroup-h{font:700 10.5px/1.6 var(--micro);letter-spacing:.13em;
  text-transform:uppercase;color:var(--smoke);margin-bottom:2px}
.hp-cgroup-b{color:var(--tallow);font-size:12.5px;line-height:1.6}

/* the long reference material stays available without making the path to play
   compete with it. native details keeps the interaction useful without a script. */
.hp-details{margin-top:16px;border:1px solid var(--pencil);border-radius:var(--r);
  background:var(--den);padding:0 18px}
.hp-details > summary{cursor:pointer;color:var(--cream);font:700 10.5px/1.6 var(--micro);
  letter-spacing:.13em;text-transform:uppercase;padding:14px 0}
.hp-details[open] > summary{border-bottom:1px solid var(--pencil)}
.hp-details > summary::marker{color:var(--smoke)}
.hp-details .hp-contents,.hp-details .hp-new{margin:16px 0}
.hp-details .hp-note{margin-bottom:14px}

/* the footer spark, retinted to the one accent */
.hp-spark{color:var(--flame)}
`;

function shell({ title, desc, body, built, cssHref }) {
  return [
    '<!doctype html><html lang=en><head><meta charset=utf-8>',
    '<meta name=viewport content="width=device-width,initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name=description content="${esc(desc)}">`,
    '<meta name=theme-color content="#14100e">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="cinder works">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<link rel=stylesheet href="${esc(cssHref)}">`,
    '<link rel=icon type=image/png sizes=32x32 href="/cw-icon-32.png">',
    `<style>${CSS}</style></head><body>`,
    FLAME_SYMBOL,
    '<div class=page>',
    '<div class=banner><div class=bl><a class=brand href="index.html">'
      + '<svg class=mark aria-hidden=true><use href="#flame"/></svg>'
      + '<span class=wordmark>the hearth</span></a>'
      + '<span class=rev>client pack</span></div></div>',
    body,
    `<footer><span class=hp-spark>&#10022;</span> the hearth &middot; a hart forge minecraft server `
      + `&middot; page built ${esc(built)} &middot; `
      + `<a href="${esc(CONFIG.serverPage)}">the server page</a> &middot; `
      + `<a href="${esc(CONFIG.modrinthPage)}">on modrinth</a> &middot; the modded server is `
      + `<a href="${esc(CONFIG.foundryPage)}">the foundry</a></footer>`,
    '</div></body></html>',
  ].join('\n');
}

function section(label, inner) {
  return `<div class=sec><div class=lbl>${label}</div>\n${inner}\n</div>`;
}

function specRow(term, value) {
  return `<dt>${term}</dt><dd>${value}</dd>`;
}

// ----------------------------------------------------------------- the page

function renderPage({ pack, loader, server, counts, groups, release, built, cssHref }) {
  const href = `downloads/${pack.name}`;

  // every step's text lives in ONE <span> - see the .hp-steps note in CSS.
  const step = (html) => `<li><span>${html}</span></li>`;

  const lede = [
    `<p class=hp-optional>${esc(packRequirementLabel(server.pack_required))}.</p>`,
    '<p class=hp-lede>the hearth runs a <b>vanilla-client rule</b> and always will. a plain, '
      + 'unmodded minecraft client joins fine, and so does bedrock from a phone, console, switch or '
      + 'windows edition. nothing on this page is a requirement and nothing on it gives you an '
      + 'advantage in game.</p>',
    '<p class=hp-lede>what it does give you is a better client: more frames, shaders if you want '
      + 'them, better mob animations, and a pile of small quality-of-life things. download it, '
      + 'install it with modrinth, connect.</p>',
  ].join('\n');

  const download = section('download', [
    '<div class=hp-grab>',
    `<a class="btn btn-primary hp-get" href="${esc(CONFIG.modrinthPage)}">get it on modrinth</a>`,
    '<p class=hp-recommended><b>recommended:</b> installs in the modrinth app and updates itself.</p>',
    '<div class=hp-manual>',
    '<span class=hp-manual-label>manual alternative</span>',
    `<a href="${esc(href)}" download>download the .mrpack</a>`,
    '<div class=hp-meta>',
    `<span class=hp-file>${esc(pack.name)}</span>`,
    `<span class=hp-facts>${esc(fmtSize(pack.bytes))} &middot; ${pack.bytes.toLocaleString('en-US')} bytes `
      + `&middot; built ${esc(fmtDate(pack.built))}</span>`,
    '</div>',
    '</div>',
    `<div class=hp-callout><b>good to know:</b> this pack is ${esc(server.pack_required)}. any pack version works. `
      + 'no pack works too. the server accepts a vanilla java client. bedrock joins with no pack.</div>',
    '</div>',
    '<p class=hp-note>the file is small because almost nothing is inside it. an .mrpack is a '
      + 'list: your launcher downloads every mod, shader and resource pack straight from the '
      + "author's own upload. what the file does carry is our own bits: the keybinds, the resource "
      + 'pack order, sane render distances, one config fix, and the hearth already sitting in your '
      + 'multiplayer list.</p>',
    '<dl class=hp-spec>',
    specRow('version', `<b>${esc(pack.version)}</b>`),
    specRow('sha256', esc(pack.sha256)),
    '</dl>',
  ].join('\n'));

  const install = section('install', [
    '<ol class=hp-steps>',
    step(`open <a href="${esc(CONFIG.modrinthPage)}">the hearth pack on modrinth</a> in the `
      + '<b>modrinth app</b> and choose <b>install</b>. it keeps the pack updated for you.'),
    step('let it pull everything down. the first launch takes a few minutes and the first world '
      + 'load is slower still. after that it is faster than vanilla, which is most of the point.'),
    step(`give the instance <b>${CONFIG.ramGb}g</b> of ram before you play. instance settings, then `
      + 'java, then allocated memory.'),
    step(`the hearth is already in your multiplayer list. if it is not, add <b>${esc(server.java_host)}</b>.`),
    step(`manual alternative: get a launcher that takes a <b>.mrpack</b>, then download the file above. `
      + `the <a href="${esc(CONFIG.appUrl)}">modrinth app</a>, prism, labymod and most others do. `
      + "curseforge's launcher does not."),
    step('modrinth app: <b>add instance</b>, then <b>from file</b>, then pick the .mrpack. '
      + 'prism: <b>add instance</b>, <b>import</b>. labymod: drop it on the launcher.'),
    '</ol>',
    '<p class=hp-note>updating: modrinth handles it. manual installs need the new .mrpack imported '
      + 'over the same instance every release. your worlds, settings and keybinds all survive the '
      + 'reinstall. the dynamic-fps config re-applies each time.</p>',
  ].join('\n'));

  const connecting = section('connecting', [
    `<div class=hp-addr><span class=hp-side>java</span>${esc(server.java_host)}</div>`,
    `<div class=hp-addr><span class=hp-side>bedrock</span>${esc(server.bedrock_host)}`
      + `<span class=hp-port>port ${server.bedrock_port}</span></div>`,
    '<p class=hp-note>java takes no port, bedrock needs that one. that port is the only '
      + 'difference between them, same world, same people, same everything else.</p>',
    '<dl class=hp-spec>',
    specRow('minecraft', esc(server.mc_version)),
    specRow('loader', esc(loaderLabel(server))),
    // the pack this page is actually serving, not the hub facts.json value
    // (that one sat at 2.0.1 and went stale, so the row disagreed with the file).
    specRow('pack', `<b>${esc(pack.version)}</b>`),
    specRow('java', esc(packRequirementLabel(server.pack_required))),
    specRow('bedrock', 'always, no pack exists or is needed'),
    '</dl>',
    '<p class=hp-note>the pack is <b>not</b> version-locked to the server: everything in it '
      + 'is client-side, so an out of date pack still connects, you just miss whatever is new. it '
      + 'is java only, since an .mrpack is a fabric manifest with no bedrock equivalent, so '
      + 'bedrock players get the plain game and lose nothing they could have had.</p>',
  ].join('\n'));

  // one block per manifest group: sub-label, then a dense comma-separated run
  // of display names. plain lists, not prose - see readManifestGroups().
  const contentGroups = groups
    .filter(([, slugs]) => slugs.length)
    .map(([label, slugs]) => `<div class=hp-cgroup><div class=hp-cgroup-h>${esc(label)}</div>`
      + `<div class=hp-cgroup-b>${slugs.map((s) => esc(humanize(s))).join(', ')}</div></div>`)
    .join('\n');

  const contents = section('what is in it', [
    '<dl class=hp-spec>',
    specRow('mods', `<b>${counts.mods}</b>`),
    specRow('shaders', `${counts.shaders} <span class=hp-facts>(off until you pick one)</span>`),
    specRow('resource packs', `${counts.resourcepacks} <span class=hp-facts>(fresh animations and its addons on, whimscape off)</span>`),
    specRow('entries', `${counts.total}`),
    '</dl>',
    '<details class=hp-details>',
    `<summary>see every mod, shader and resource pack</summary>`,
    `<div class=hp-contents>${contentGroups}</div>`,
    '<p class=hp-note>client-visual and client-comfort only: no minimap-cheating, x-ray, '
      + 'freecam or auto-clicker.</p>',
    '</details>',
  ].join('\n'));

  const log = section('what changed for players', [
    '<ul class=hp-summary>',
    ...release.player_summary.map((item) => `<li><span>${inline(item)}</span></li>`),
    '</ul>',
    `<p class=hp-note>${esc(release.compat_warning)}</p>`,
    `<p class=hp-note><a href="${esc(FULL_HISTORY_URL)}">read the full history</a></p>`,
  ].join('\n'));

  const alt = section('the other way in', [
    '<ul class=rows>',
    '<li><span class=arw>-&gt;</span><span>discord</span>'
      + '<span class=desc>calcifer posts the same .mrpack on the server status card and re-attaches '
      + 'it on every version bump. this page is the copy that is always current.</span></li>',
    `<li><span class=arw>-&gt;</span><span>no pack at all</span>`
      + '<span class=desc>still a supported way to play. join on a plain client and nothing is '
      + 'missing but the shine.</span></li>',
    '</ul>',
  ].join('\n'));

  return shell({
    title: 'the hearth - client pack',
    desc: `the hearth's ${server.pack_required} client pack ${pack.version} for minecraft ${server.mc_version} ${server.loader}. `
      + `better frames, shaders and animations. not required: a plain client and bedrock join `
      + `${server.java_host} fine.`,
    built,
    cssHref,
    body: [lede, download, install, connecting, contents, log, alt].filter(Boolean).join('\n'),
  });
}

// ---------------------------------------------------------------------- write

function writeText(file, s) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, s);
}

function main() {
  const log = (s) => process.stdout.write(s + '\n');

  const loader = readLoader();
  const server = loadHearthFacts();
  const cssHref = stylesheetHref();
  const pack = latestPack(loader.mc);
  const counts = readManifest();
  const groups = readManifestGroups();
  const overrides = readOverrides();
  const release = releaseFor(pack.version);
  const built = fmtDateTime(new Date());

  // a built pack that is older than what build_mrpack.py is set to produce is
  // the one failure mode that would silently ship a stale sha256 on the page.
  if (pack.version !== loader.packVersion) {
    process.stderr.write(`build_site: WARNING build_mrpack.py says PACK_VERSION=${loader.packVersion} `
      + `but the newest built pack is ${pack.version} - run build_mrpack.py first\n`);
  }
  writeText(path.join(CONFIG.outDir, 'index.html'),
    renderPage({ pack, loader, server, counts, groups, release, built, cssHref }));
  fs.mkdirSync(path.join(CONFIG.outDir, 'downloads'), { recursive: true });
  fs.copyFileSync(pack.file, path.join(CONFIG.outDir, 'downloads', pack.name));

  log(`pack      ${pack.name}  ${fmtSize(pack.bytes)}  ${pack.sha256}`);
  log(`loader    minecraft ${server.mc_version}, ${loaderLabel(server)}`);
  log(`manifest  ${counts.mods} mods, ${counts.shaders} shaders, ${counts.resourcepacks} resource packs`
    + `  (${counts.total} entries, ${overrides.length} override files)`);
  log(`release   ${release.player_summary.length} player summary items`);
  log(`wrote     ${path.join(CONFIG.outDir, 'index.html')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`build_site: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { cmpVersion, readManifest, readChangelog, releaseFor, fmtDate, inline,
  loadHearthFacts, stylesheetHref, packRequirementLabel, loaderLabel,
  DEFAULT_FACTS_PATH, DEFAULT_CSS_MANIFEST_PATH };
