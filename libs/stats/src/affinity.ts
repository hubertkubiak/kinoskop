import type { Person } from '@kinoskop/shared';
import { displayTitle, isRated, type LibraryItem, personKey } from './model';

/**
 * "Twój gust" (SPEC §7.8): which features of a title go together with the user's higher or lower
 * ratings, as plain ranked lists instead of a node graph (docs/adr/0002).
 */
export type AffinityKind = 'genre' | 'country' | 'director' | 'cast';

export interface Affinity {
  kind: AffinityKind;
  key: string;
  /** Genre label, ISO country code or person name (the UI formats countries). */
  label: string;
  person?: Person;
  n: number;
  avg: number;
  /** Shrunk mean minus the user's overall mean (points); > 0 = rated above the user's usual. */
  lift: number;
}

export interface TasteAffinities {
  overall: number;
  boosts: Affinity[];
  drags: Affinity[];
}

/** Shrinkage towards the overall mean, so 2 lucky titles do not beat 30 good ones. */
const SHRINK_K = 3;
/** Smaller differences are not worth showing. */
export const MIN_LIFT = 0.3;

const r2 = (x: number) => Math.round(x * 100) / 100;

function featuresOf(it: LibraryItem): { kind: AffinityKind; key: string; label: string; person?: Person }[] {
  const e = it.enrichment;
  if (!e) return [];
  return [
    ...e.genres.map((g) => ({ kind: 'genre' as const, key: g, label: g })),
    ...e.countries.map((c) => ({ kind: 'country' as const, key: c, label: c })),
    ...e.directors.map((p) => ({ kind: 'director' as const, key: personKey(p), label: p.name, person: p })),
    ...e.cast.map((p) => ({ kind: 'cast' as const, key: personKey(p), label: p.name, person: p })),
  ];
}

export function tasteAffinities(items: LibraryItem[], minN = 5): TasteAffinities {
  const rated = items.filter(isRated);
  const overall = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;
  const agg = new Map<string, Omit<Affinity, 'avg' | 'lift'> & { sum: number; seen: Set<string> }>();
  for (const it of rated) {
    for (const f of featuresOf(it)) {
      const id = `${f.kind}:${f.key}`;
      const a = agg.get(id) ?? { ...f, n: 0, sum: 0, seen: new Set<string>() };
      if (a.seen.has(it.key)) continue;
      a.seen.add(it.key);
      a.n++;
      a.sum += it.rating;
      if (!a.person?.profileUrl && f.person?.profileUrl) a.person = f.person;
      agg.set(id, a);
    }
  }
  const all: Affinity[] = [...agg.values()]
    .filter((a) => a.n >= minN)
    .map((a) => {
      const avg = a.sum / a.n;
      const shrunk = (a.n * avg + SHRINK_K * overall) / (a.n + SHRINK_K);
      return { kind: a.kind, key: a.key, label: a.label, person: a.person, n: a.n, avg: r2(avg), lift: r2(shrunk - overall) };
    });
  const byLift = (a: Affinity, b: Affinity) => b.lift - a.lift || b.n - a.n || a.label.localeCompare(b.label, 'pl');
  return {
    overall: r2(overall),
    boosts: all.filter((a) => a.lift >= MIN_LIFT).sort(byLift),
    drags: all.filter((a) => a.lift <= -MIN_LIFT).sort((a, b) => byLift(b, a)),
  };
}

export interface SharedTitle {
  key: string;
  title: string;
  rating?: number;
}

export interface Duo {
  director: Person;
  actor: Person;
  titles: SharedTitle[];
  avg?: number;
}

const avgRating = (titles: SharedTitle[]) => {
  const r = titles.map((t) => t.rating).filter((x): x is number => x !== undefined);
  return r.length ? r2(r.reduce((s, x) => s + x, 0) / r.length) : undefined;
};

/** Director–actor pairs that worked together on at least `minShared` watched titles. */
export function directorActorDuos(items: LibraryItem[], minShared = 3): Duo[] {
  const m = new Map<string, Duo>();
  for (const it of items) {
    if (it.list !== 'rated' || !it.enrichment) continue;
    for (const d of it.enrichment.directors) {
      for (const a of it.enrichment.cast) {
        if (personKey(a) === personKey(d)) continue;
        const id = `${personKey(d)}|${personKey(a)}`;
        const duo = m.get(id) ?? { director: d, actor: a, titles: [] };
        if (!duo.titles.some((t) => t.key === it.key)) duo.titles.push({ key: it.key, title: displayTitle(it), rating: it.rating });
        m.set(id, duo);
      }
    }
  }
  return [...m.values()]
    .filter((d) => d.titles.length >= minShared)
    .map((d) => ({ ...d, avg: avgRating(d.titles) }))
    .sort((a, b) => b.titles.length - a.titles.length || (b.avg ?? 0) - (a.avg ?? 0));
}

export interface Collaborator {
  person: Person;
  key: string;
  titles: SharedTitle[];
  avg?: number;
}

/** People who share at least `minShared` watched titles with the person `key` (any role). */
export function collaboratorsOf(items: LibraryItem[], key: string, minShared = 2): { person?: Person; collaborators: Collaborator[] } {
  const peopleOf = (it: LibraryItem) => [...(it.enrichment?.directors ?? []), ...(it.enrichment?.cast ?? [])];
  const own = items.filter((it) => peopleOf(it).some((p) => personKey(p) === key));
  const me = own.flatMap(peopleOf).find((p) => personKey(p) === key);
  const m = new Map<string, Collaborator>();
  for (const it of own) {
    for (const p of peopleOf(it)) {
      const k = personKey(p);
      if (k === key) continue;
      const c = m.get(k) ?? { person: p, key: k, titles: [] };
      if (!c.titles.some((t) => t.key === it.key)) c.titles.push({ key: it.key, title: displayTitle(it), rating: it.rating });
      m.set(k, c);
    }
  }
  return {
    person: me,
    collaborators: [...m.values()]
      .filter((c) => c.titles.length >= minShared)
      .map((c) => ({ ...c, avg: avgRating(c.titles) }))
      .sort((a, b) => b.titles.length - a.titles.length || a.person.name.localeCompare(b.person.name, 'pl')),
  };
}
