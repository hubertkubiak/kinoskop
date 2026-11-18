#!/usr/bin/env node
/**
 * Demo profile generator (SPEC §14.3).
 *
 * Picks popular titles from Wikidata (CC0) that have a Filmweb ID (P5032 / P3995) and builds:
 *  - apps/web/public/assets/demo/demo-export.json      – fictional "Widz Demo" export (ExportFile)
 *  - apps/web/public/assets/demo/demo-enrichment.json  – public metadata (Enrichment[]) from Wikidata
 * Ratings are random but deterministic (fixed seed) with clear preferences, so stats look alive.
 * Nothing is taken from Filmweb. Run: `pnpm demo:generate` (needs network access to Wikidata).
 *
 * Wikidata IDs used here were verified by label queries on 2026-11-18 (see apps/api/src/wikidata/ids.ts).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'apps/web/public/assets/demo');
const SEED = 20261118;
const UA = 'Kinoskop-demo-generator/0.1 (https://github.com/kinoskop; local dev tool)';
const COUNTS = { film: 300, serial: 80, game: 20 };

// ── deterministic PRNG ────────────────────────────────────────────────────────
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── SPARQL with retry ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sparql(query, attempt = 1) {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) {
    if (attempt >= 6) throw new Error(`SPARQL ${res.status}`);
    await sleep(1500 * attempt);
    return sparql(query, attempt + 1);
  }
  await sleep(300);
  return (await res.json()).results.bindings;
}
const qid = (uri) => uri.slice(uri.lastIndexOf('/') + 1);
const values = (ids) => ids.map((q) => `wd:${q}`).join(' ');

// ── genre mapping (mirror of libs/shared/src/genres.ts, film/TV subset) ───────
async function loadGenreMapper() {
  const src = await readFile(join(ROOT, 'libs/shared/src/genres.ts'), 'utf8');
  const block = (name) => {
    const m = new RegExp(`const ${name}: Record<string, string\\[\\]> = \\{([\\s\\S]*?)\\n\\};`).exec(src);
    const dict = {};
    for (const line of m[1].split('\n')) {
      const mm = /^\s*(?:'([^']+)'|"([^"]+)"|([a-z-]+)):\s*\[([^\]]*)\]/.exec(line);
      if (mm) dict[mm[1] ?? mm[2] ?? mm[3]] = [...mm[4].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    }
    return dict;
  };
  const FILM = block('FILM_TV');
  const GAME = block('GAMES');
  const suffixes = [' film', ' films', ' television series', ' tv series', ' television program', ' video game', ' game', ' genre', ' fiction'];
  return (label, kind) => {
    let n = label.trim().toLowerCase();
    for (const s of suffixes) if (n.endsWith(s) && n !== 'science fiction') n = n.slice(0, -s.length);
    n = n.trim();
    const dict = kind === 'game' ? GAME : FILM;
    return dict[n] ?? (n === 'science' ? FILM['science fiction'] : null);
  };
}

// ── era mapping (simplified mirror of libs/shared/src/eras.ts) ───────────────
function eraFromYear(y) {
  if (y < -3000) return 'prehistory';
  if (y < 500) return 'antiquity';
  if (y < 1450) return 'middle-ages';
  if (y < 1600) return 'renaissance';
  if (y < 1700) return '17c';
  if (y < 1800) return '18c';
  if (y < 1900) return '19c';
  if (y < 2000) return `${Math.floor(y / 10) * 10}s`;
  return 'contemporary';
}
function eraFromLabel(label, start) {
  const l = label.toLowerCase();
  if (l.includes('world war ii') || l.includes('second world war')) return 'ww2';
  if (l.includes('middle ages') || l.includes('medieval')) return 'middle-ages';
  if (l.includes('future')) return 'future';
  if (l.includes('ancient') || l.includes('antiquity')) return 'antiquity';
  if (l.includes('prehistor')) return 'prehistory';
  if (/^(1[5-9]|20)\d0s$/.test(l)) return eraFromYear(Number(l.slice(0, 4)));
  if (start) return eraFromYear(new Date(start).getUTCFullYear());
  return null;
}

// ── selection ────────────────────────────────────────────────────────────────
async function pickTitles() {
  const films = await sparql(`SELECT ?item ?fw ?links WHERE { ?item wdt:P4947 ?tmdb; wdt:P5032 ?fw; wdt:P31 wd:Q11424; wikibase:sitelinks ?links. FILTER(?links > 45) } ORDER BY DESC(?links) LIMIT 900`);
  const series = await sparql(`SELECT ?item ?fw ?links WHERE { ?item wdt:P4983 ?tmdb; wdt:P5032 ?fw; wikibase:sitelinks ?links. FILTER(?links > 25) } ORDER BY DESC(?links) LIMIT 250`);
  // Games: Filmweb IDs exist only in the slug property P3995 ("videogame/Title-Year-ID").
  const games = await sparql(`SELECT ?item ?slug WHERE { ?item wdt:P31 wd:Q7889; wdt:P3995 ?slug. FILTER(STRSTARTS(?slug, "videogame/")) }`);
  const uniq = (rows, fwOf) => {
    const seen = new Set();
    return rows
      .map((r) => ({ qid: qid(r.item.value), filmwebId: fwOf(r) }))
      .filter((r) => Number.isInteger(r.filmwebId) && r.filmwebId > 0 && !seen.has(r.qid) && seen.add(r.qid));
  };
  return {
    film: shuffle(uniq(films, (r) => Number(r.fw.value))).slice(0, COUNTS.film),
    serial: shuffle(uniq(series, (r) => Number(r.fw.value))).slice(0, COUNTS.serial),
    game: shuffle(uniq(games, (r) => Number(/-(\d+)$/.exec(r.slug.value)?.[1]))).slice(0, COUNTS.game),
  };
}

// ── details in batches ───────────────────────────────────────────────────────
async function details(qids) {
  const d = new Map(qids.map((q) => [q, { genres: new Set(), countries: new Set(), directors: new Map(), cast: new Map(), eras: new Set(), locations: new Set(), awards: [] }]));
  for (let i = 0; i < qids.length; i += 60) {
    const v = values(qids.slice(i, i + 60));
    const base = await sparql(`SELECT ?item ?pl ?en ?date ?dur ?tmdb ?tmdbtv WHERE { VALUES ?item { ${v} }
      OPTIONAL { ?item rdfs:label ?pl FILTER(lang(?pl)='pl') } OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)='en') }
      OPTIONAL { ?item wdt:P577 ?date } OPTIONAL { ?item p:P2047/psv:P2047 [ wikibase:quantityAmount ?dur; wikibase:quantityUnit wd:Q7727 ] }
      OPTIONAL { ?item wdt:P4947 ?tmdb } OPTIONAL { ?item wdt:P4983 ?tmdbtv } }`);
    for (const r of base) {
      const o = d.get(qid(r.item.value));
      o.title ??= r.pl?.value;
      o.originalTitle ??= r.en?.value;
      const y = r.date ? new Date(r.date.value).getUTCFullYear() : undefined;
      if (y && (!o.year || y < o.year)) o.year = y;
      if (r.dur && !o.runtime) o.runtime = Math.round(Number(r.dur.value));
      o.tmdbId ??= r.tmdb ? Number(r.tmdb.value) : r.tmdbtv ? Number(r.tmdbtv.value) : undefined;
    }
    for (const r of await sparql(`SELECT ?item ?gl WHERE { VALUES ?item { ${v} } ?item wdt:P136 ?g. ?g rdfs:label ?gl FILTER(lang(?gl)='en') }`))
      d.get(qid(r.item.value)).genres.add(r.gl.value);
    for (const r of await sparql(`SELECT ?item ?iso WHERE { VALUES ?item { ${v} } ?item wdt:P495/wdt:P297 ?iso }`))
      d.get(qid(r.item.value)).countries.add(r.iso.value);
    for (const [prop, key] of [['P57', 'directors'], ['P161', 'cast']]) {
      const rows = await sparql(`SELECT ?item ?p ?name ?tmdbp ?iso WHERE { VALUES ?item { ${v} } ?item wdt:${prop} ?p.
        ?p rdfs:label ?name FILTER(lang(?name)='en') OPTIONAL { ?p wdt:P4985 ?tmdbp } OPTIONAL { ?p wdt:P27/wdt:P297 ?iso } }`);
      for (const r of rows) {
        const m = d.get(qid(r.item.value))[key];
        const pq = qid(r.p.value);
        const person = m.get(pq) ?? { name: r.name.value, wikidataId: pq, tmdbId: r.tmdbp ? Number(r.tmdbp.value) : undefined, nationalities: new Set() };
        if (r.iso) person.nationalities.add(r.iso.value);
        m.set(pq, person);
      }
    }
    for (const r of await sparql(`SELECT ?item ?pl ?start ?pit WHERE { VALUES ?item { ${v} } ?item wdt:P2408 ?p. ?p rdfs:label ?pl FILTER(lang(?pl)='en')
      OPTIONAL { ?p wdt:P580 ?start } OPTIONAL { ?p wdt:P585 ?pit } }`)) {
      const era = eraFromLabel(r.pl.value, r.start?.value ?? r.pit?.value);
      if (era) d.get(qid(r.item.value)).eras.add(era);
    }
    for (const r of await sparql(`SELECT ?item ?ll WHERE { VALUES ?item { ${v} } ?item wdt:P840 ?l. ?l rdfs:label ?ll FILTER(lang(?ll)='pl') }`))
      d.get(qid(r.item.value)).locations.add(r.ll.value);
    process.stdout.write(`  details ${Math.min(i + 60, qids.length)}/${qids.length}\r`);
  }
  console.log();
  return d;
}

// ── ratings with preferences ─────────────────────────────────────────────────
const LIKES = { Dramat: 0.9, 'Sci-Fi': 1.1, Kryminał: 0.7, Wojenny: 0.6, Animacja: 0.5, RPG: 1.2 };
const DISLIKES = { Horror: -1.6, Komedia: -0.7, Romans: -0.9, Musical: -1.2 };

function rate(genres, year) {
  let r = 6.6 + gauss() * 1.4;
  for (const g of genres) r += (LIKES[g] ?? 0) + (DISLIKES[g] ?? 0);
  if (year && year < 1980) r += 0.4;
  return Math.max(1, Math.min(10, Math.round(r)));
}

function ratedAt() {
  // skewed to recent years: 2012 → 2026-10
  const t0 = Date.UTC(2012, 0, 1);
  const t1 = Date.UTC(2026, 9, 31);
  const u = Math.pow(rnd(), 0.7);
  const d = new Date(t0 + u * (t1 - t0));
  d.setUTCHours(18 + Math.floor(rnd() * 5), Math.floor(rnd() * 60), 0, 0);
  return d.toISOString();
}

async function main() {
  const mapGenre = await loadGenreMapper();
  let awardsByWork = new Map();
  try {
    const catalog = JSON.parse(await readFile(join(ROOT, 'apps/api/src/assets/awards.json'), 'utf8'));
    for (const e of catalog.entries ?? []) {
      const def = catalog.awards.find((a) => a.key === e.awardKey);
      const list = awardsByWork.get(e.work.wikidataId) ?? [];
      list.push({ awardKey: e.awardKey, year: e.year, won: e.won, category: def?.namePl ?? e.awardKey });
      awardsByWork.set(e.work.wikidataId, list);
    }
  } catch {
    awardsByWork = new Map();
  }

  console.log('Picking titles from Wikidata…');
  const picked = await pickTitles();
  const all = Object.entries(picked).flatMap(([kind, rows]) => rows.map((r) => ({ ...r, kind })));
  console.log(`  ${all.length} titles (${Object.entries(picked).map(([k, v]) => `${k}: ${v.length}`).join(', ')})`);
  const det = await details(all.map((t) => t.qid));

  const items = [];
  const enrichments = [];
  for (const t of all) {
    const o = det.get(t.qid);
    if (!o?.title && !o?.originalTitle) continue;
    const genres = [...new Set([...o.genres].flatMap((g) => mapGenre(g, t.kind) ?? []))];
    const toPerson = (p) => ({ name: p.name, wikidataId: p.wikidataId, ...(p.tmdbId ? { tmdbId: p.tmdbId } : {}), nationalities: [...p.nationalities].sort() });
    enrichments.push({
      filmwebId: t.filmwebId,
      kind: t.kind,
      match: { wikidataId: t.qid, ...(o.tmdbId ? { tmdbId: o.tmdbId } : {}), method: 'wikidata', confidence: 1 },
      title: o.title ?? o.originalTitle,
      ...(o.originalTitle && o.originalTitle !== o.title ? { originalTitle: o.originalTitle } : {}),
      ...(o.year ? { year: o.year } : {}),
      genres,
      countries: [...o.countries].sort(),
      directors: [...o.directors.values()].slice(0, 3).map(toPerson),
      cast: [...o.cast.values()].slice(0, 10).map(toPerson),
      setInPeriod: [...o.eras].map((key) => ({ key, source: 'wikidata' })),
      narrativeLocations: [...o.locations].slice(0, 5),
      keywords: [],
      ...(o.runtime && t.kind === 'film' && o.runtime > 20 && o.runtime < 400 ? { runtimeMinutes: o.runtime } : {}),
      awards: awardsByWork.get(t.qid) ?? [],
    });
    const want = rnd() < 0.14;
    const item = { filmwebId: t.filmwebId, kind: t.kind, list: want ? 'want2see' : 'rated' };
    if (!want) {
      item.rating = rate(genres, o.year);
      item.ratedAt = ratedAt();
      if (item.rating === 10 && rnd() < 0.5) item.favorite = true;
    }
    items.push(item);
  }

  const file = {
    schemaVersion: 1,
    exportedAt: '2026-11-18T12:00:00.000Z',
    source: 'filmweb',
    scriptVersion: 'demo',
    user: { id: 0, name: 'Widz Demo' },
    items,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'demo-export.json'), JSON.stringify(file) + '\n');
  await writeFile(join(OUT, 'demo-enrichment.json'), JSON.stringify(enrichments) + '\n');
  console.log(`Wrote ${items.length} items and ${enrichments.length} enrichments to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
