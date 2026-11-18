import { z } from 'zod';

/**
 * Normalised list of story periods (SPEC §7.5), in chronological order.
 * `unknown` is only a valid AI answer (see ai/era-prompt.ts); it is never stored as an era.
 */
export const ERA_KEYS = [
  'prehistory',
  'antiquity',
  'middle-ages',
  'renaissance',
  '17c',
  '18c',
  '19c',
  '1900s',
  '1910s',
  '1920s',
  '1930s',
  '1940s',
  'ww2',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  'contemporary',
  'future',
  'fictional',
] as const;

export const EraKeySchema = z.enum(ERA_KEYS);
export type EraKey = z.infer<typeof EraKeySchema>;

export const EraSourceSchema = z.enum(['wikidata', 'keywords', 'ai']);
export type EraSource = z.infer<typeof EraSourceSchema>;

export const EraSchema = z.object({ key: EraKeySchema, source: EraSourceSchema });
export type Era = z.infer<typeof EraSchema>;

export const ERA_LABELS: Record<EraKey, string> = {
  prehistory: 'Prehistoria',
  antiquity: 'Starożytność',
  'middle-ages': 'Średniowiecze',
  renaissance: 'Renesans i XVI w.',
  '17c': 'XVII w.',
  '18c': 'XVIII w.',
  '19c': 'XIX w.',
  '1900s': '1900–1909',
  '1910s': 'Lata 10.',
  '1920s': 'Lata 20.',
  '1930s': 'Lata 30.',
  '1940s': 'Lata 40.',
  ww2: 'II wojna światowa',
  '1950s': 'Lata 50.',
  '1960s': 'Lata 60.',
  '1970s': 'Lata 70.',
  '1980s': 'Lata 80.',
  '1990s': 'Lata 90.',
  contemporary: 'Współczesność (od 2000)',
  future: 'Przyszłość / SF',
  fictional: 'Świat fikcyjny',
};

/** Sources treated as "certain" by the "only certain sources" filter. */
export const CERTAIN_ERA_SOURCES: readonly EraSource[] = ['wikidata', 'keywords'];

/** Maps a calendar year (negative = BCE) to an era bucket. */
export function eraFromYear(year: number): EraKey {
  if (year < -3000) return 'prehistory';
  if (year < 500) return 'antiquity';
  if (year < 1450) return 'middle-ages';
  if (year < 1600) return 'renaissance';
  if (year < 1700) return '17c';
  if (year < 1800) return '18c';
  if (year < 1900) return '19c';
  if (year < 2000) return `${Math.floor(year / 10) * 10}s` as EraKey;
  return 'contemporary';
}

const DECADE_RE = /^(1[5-9]|20)\d0s$/;
const CENTURY_RE = /^(\d{1,2})(?:st|nd|rd|th)[ -]century( bc| bce)?$/;

/**
 * Era from an English label: a TMDB keyword or the Wikidata label of a P2408 value.
 * Matching on labels (not on Q-IDs) keeps the dictionary verifiable by simply reading it.
 */
export function eraFromLabel(rawLabel: string): EraKey | undefined {
  const label = rawLabel.trim().toLowerCase();
  const direct = LABEL_TO_ERA[label];
  if (direct) return direct;

  if (DECADE_RE.test(label)) return eraFromYear(Number(label.slice(0, 4)));

  const century = CENTURY_RE.exec(label);
  if (century) {
    const n = Number(century[1]);
    if (century[2]) return n > 30 ? 'prehistory' : 'antiquity';
    if (n >= 21) return n === 21 ? 'contemporary' : 'future';
    return eraFromYear((n - 1) * 100 + 50);
  }
  for (const [needle, era] of LABEL_SUBSTRINGS) {
    if (label.includes(needle)) return era;
  }
  return undefined;
}

const LABEL_TO_ERA: Record<string, EraKey> = {
  prehistory: 'prehistory',
  prehistoric: 'prehistory',
  'prehistoric times': 'prehistory',
  'stone age': 'prehistory',
  'ice age': 'prehistory',
  caveman: 'prehistory',
  'bronze age': 'antiquity',
  antiquity: 'antiquity',
  'classical antiquity': 'antiquity',
  'ancient history': 'antiquity',
  'ancient rome': 'antiquity',
  'ancient greece': 'antiquity',
  'ancient egypt': 'antiquity',
  'roman empire': 'antiquity',
  'middle ages': 'middle-ages',
  medieval: 'middle-ages',
  'viking age': 'middle-ages',
  'early middle ages': 'middle-ages',
  'high middle ages': 'middle-ages',
  'late middle ages': 'middle-ages',
  renaissance: 'renaissance',
  'elizabethan era': 'renaissance',
  'victorian era': '19c',
  'napoleonic wars': '19c',
  'american civil war': '19c',
  'world war i': '1910s',
  'first world war': '1910s',
  'world war ii': 'ww2',
  'second world war': 'ww2',
  holocaust: 'ww2',
  'the holocaust': 'ww2',
  'roaring twenties': '1920s',
  'great depression': '1930s',
  'near future': 'future',
  future: 'future',
  dystopia: 'future',
  'distant future': 'future',
  'post-apocalyptic future': 'future',
  'fictional world': 'fictional',
  'high fantasy': 'fictional',
  'alternate world': 'fictional',
  'parallel world': 'fictional',
  '21st century': 'contemporary',
};

const LABEL_SUBSTRINGS: [string, EraKey][] = [
  ['world war ii', 'ww2'],
  ['ancient ', 'antiquity'],
  ['medieval', 'middle-ages'],
  ['fictional universe', 'fictional'],
];

/** Deduplicates eras keeping the most certain source for each key. */
export function mergeEras(...lists: Era[][]): Era[] {
  const rank: Record<EraSource, number> = { wikidata: 0, keywords: 1, ai: 2 };
  const byKey = new Map<EraKey, Era>();
  for (const era of lists.flat()) {
    const prev = byKey.get(era.key);
    if (!prev || rank[era.source] < rank[prev.source]) byKey.set(era.key, era);
  }
  return ERA_KEYS.filter((k) => byKey.has(k)).map((k) => byKey.get(k) as Era);
}
