import type { Person } from '@kinoskop/shared';
import { displayTitle, isRated, type LibraryItem, mean, personKey, round1 } from './model';

export interface PersonRow {
  key: string;
  person: Person;
  count: number;
  rated: number;
  avg?: number;
  titles: { key: string; title: string; rating?: number; year?: number }[];
}

/** Ranking of directors or actors by watched titles (SPEC §7.6). */
export function peopleRanking(items: LibraryItem[], role: 'director' | 'cast', minCount = 3): PersonRow[] {
  const map = new Map<string, PersonRow & { ratings: number[] }>();
  for (const it of items) {
    const people = (role === 'director' ? it.enrichment?.directors : it.enrichment?.cast) ?? [];
    for (const p of people) {
      const k = personKey(p);
      let row = map.get(k);
      if (!row) map.set(k, (row = { key: k, person: p, count: 0, rated: 0, titles: [], ratings: [] }));
      if (row.titles.some((t) => t.key === it.key)) continue;
      row.count++;
      if (!row.person.profileUrl && p.profileUrl) row.person = p;
      if (isRated(it)) row.ratings.push(it.rating);
      row.titles.push({ key: it.key, title: displayTitle(it), rating: it.rating, year: it.year ?? it.enrichment?.year });
    }
  }
  return [...map.values()]
    .filter((r) => r.count >= minCount)
    .map(({ ratings, ...r }) => ({ ...r, rated: ratings.length, avg: round1(mean(ratings)) }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0) || a.person.name.localeCompare(b.person.name, 'pl'));
}

/** All of a person's titles in the library (any role). */
export function titlesOfPerson(items: LibraryItem[], key: string): LibraryItem[] {
  return items.filter((it) =>
    [...(it.enrichment?.directors ?? []), ...(it.enrichment?.cast ?? [])].some((p) => personKey(p) === key),
  );
}
