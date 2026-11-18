import { ERA_KEYS, KINDS, type EraKey, type Kind, type ListKind } from '@kinoskop/shared';
import { EMPTY_FILTERS, type Filters, type Range } from './filters';

/** Serialises filters to URL query params (only non-default values). */
export function filtersToParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  const list = (k: string, v: readonly string[]) => v.length && (p[k] = v.join(','));
  const range = (k: string, r: Range | readonly [string, string] | null) => r && (p[k] = `${r[0]}..${r[1]}`);
  list('typ', f.kinds);
  list('lista', f.lists);
  range('ocena', f.rating);
  range('rok', f.year);
  range('dataOceny', f.ratedAt);
  list('gatunek', f.genres);
  if (f.genreMode === 'all') p['gatunekTryb'] = 'all';
  list('kraj', f.countries);
  list('narodowoscRez', f.directorNationalities);
  list('epoka', f.eras);
  if (f.erasCertainOnly) p['epokaPewne'] = '1';
  list('osoba', f.people);
  list('nagroda', f.awards);
  if (f.awardMode === 'won') p['nagrodaTryb'] = 'won';
  if (f.favorite) p['ulubione'] = '1';
  return p;
}

const splitList = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : []);

function parseNumRange(v: string | undefined, min: number, max: number): Range | null {
  const m = v && /^(\d{1,4})\.\.(\d{1,4})$/.exec(v);
  if (!m) return null;
  const a = Math.max(min, Number(m[1]));
  const b = Math.min(max, Number(m[2]));
  return a <= b ? [a, b] : null;
}

function parseDateRange(v: string | undefined): readonly [string, string] | null {
  const m = v && /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(v);
  return m && m[1] <= m[2] ? [m[1], m[2]] : null;
}

/** Parses query params into filters; unknown or malformed values are ignored. */
export function paramsToFilters(p: Record<string, string | undefined>): Filters {
  return {
    ...EMPTY_FILTERS,
    kinds: splitList(p['typ']).filter((k): k is Kind => (KINDS as string[]).includes(k)),
    lists: splitList(p['lista']).filter((k): k is ListKind => k === 'rated' || k === 'want2see'),
    rating: parseNumRange(p['ocena'], 1, 10),
    year: parseNumRange(p['rok'], 1870, 2100),
    ratedAt: parseDateRange(p['dataOceny']),
    genres: splitList(p['gatunek']),
    genreMode: p['gatunekTryb'] === 'all' ? 'all' : 'any',
    countries: splitList(p['kraj']).filter((c) => /^[A-Z]{2}$/.test(c)),
    directorNationalities: splitList(p['narodowoscRez']).filter((c) => /^[A-Z]{2}$/.test(c)),
    eras: splitList(p['epoka']).filter((e): e is EraKey => (ERA_KEYS as readonly string[]).includes(e)),
    erasCertainOnly: p['epokaPewne'] === '1',
    people: splitList(p['osoba']),
    awards: splitList(p['nagroda']),
    awardMode: p['nagrodaTryb'] === 'won' ? 'won' : 'nominated',
    favorite: p['ulubione'] === '1',
  };
}
