import { CERTAIN_ERA_SOURCES, type EraKey, type Kind, type ListKind } from '@kinoskop/shared';
import { genresOf, type LibraryItem, personKey, yearOf } from './model';

export type Range = readonly [number, number];

/** Global filter set (SPEC §7.0). Empty arrays / null mean "no constraint". */
export interface Filters {
  kinds: Kind[];
  lists: ListKind[];
  rating: Range | null;
  year: Range | null;
  /** Inclusive range of rating dates, `YYYY-MM-DD`. */
  ratedAt: readonly [string, string] | null;
  genres: string[];
  genreMode: 'any' | 'all';
  countries: string[];
  directorNationalities: string[];
  eras: EraKey[];
  erasCertainOnly: boolean;
  /** Person keys (see personKey) – director or cast member. */
  people: string[];
  awards: string[];
  awardMode: 'won' | 'nominated';
  favorite: boolean;
}

export const EMPTY_FILTERS: Filters = {
  kinds: [],
  lists: [],
  rating: null,
  year: null,
  ratedAt: null,
  genres: [],
  genreMode: 'any',
  countries: [],
  directorNationalities: [],
  eras: [],
  erasCertainOnly: false,
  people: [],
  awards: [],
  awardMode: 'nominated',
  favorite: false,
};

const inRange = (v: number | undefined, r: Range | null) =>
  r === null || (v !== undefined && v >= r[0] && v <= r[1]);

const intersects = (a: readonly string[], b: readonly string[]) => a.some((x) => b.includes(x));

/** Builds a single predicate for the filter set (compiled once, applied to every item). */
export function compileFilters(f: Filters): (it: LibraryItem) => boolean {
  const checks: ((it: LibraryItem) => boolean)[] = [];
  if (f.kinds.length) checks.push((it) => f.kinds.includes(it.kind));
  if (f.lists.length) checks.push((it) => f.lists.includes(it.list));
  if (f.rating) checks.push((it) => inRange(it.rating, f.rating));
  if (f.year) checks.push((it) => inRange(yearOf(it), f.year));
  if (f.ratedAt) {
    const [from, to] = f.ratedAt;
    checks.push((it) => {
      const d = it.ratedAt?.slice(0, 10);
      return d !== undefined && d >= from && d <= to;
    });
  }
  if (f.favorite) checks.push((it) => it.favorite === true);
  if (f.genres.length) {
    checks.push((it) => {
      const g = genresOf(it);
      return f.genreMode === 'all' ? f.genres.every((x) => g.includes(x)) : intersects(f.genres, g);
    });
  }
  if (f.countries.length) checks.push((it) => intersects(f.countries, it.enrichment?.countries ?? []));
  if (f.directorNationalities.length) {
    checks.push((it) =>
      intersects(
        f.directorNationalities,
        (it.enrichment?.directors ?? []).flatMap((d) => d.nationalities),
      ),
    );
  }
  if (f.eras.length) {
    checks.push((it) =>
      (it.enrichment?.setInPeriod ?? []).some(
        (e) =>
          f.eras.includes(e.key) && (!f.erasCertainOnly || CERTAIN_ERA_SOURCES.includes(e.source)),
      ),
    );
  }
  if (f.people.length) {
    checks.push((it) => {
      const e = it.enrichment;
      if (!e) return false;
      const keys = [...e.directors, ...e.cast].map(personKey);
      return f.people.every((p) => keys.includes(p));
    });
  }
  if (f.awards.length) {
    checks.push((it) =>
      (it.enrichment?.awards ?? []).some(
        (a) => f.awards.includes(a.awardKey) && (f.awardMode === 'nominated' || a.won),
      ),
    );
  }
  return (it) => checks.every((c) => c(it));
}

export const applyFilters = (items: LibraryItem[], f: Filters): LibraryItem[] =>
  items.filter(compileFilters(f));

/** Number of active constraints (for the "Pasuje: X z Y" header and chips). */
export function activeFilterCount(f: Filters): number {
  return (
    Number(f.kinds.length > 0) +
    Number(f.lists.length > 0) +
    Number(f.rating !== null) +
    Number(f.year !== null) +
    Number(f.ratedAt !== null) +
    Number(f.genres.length > 0) +
    Number(f.countries.length > 0) +
    Number(f.directorNationalities.length > 0) +
    Number(f.eras.length > 0) +
    Number(f.people.length > 0) +
    Number(f.awards.length > 0) +
    Number(f.favorite)
  );
}
