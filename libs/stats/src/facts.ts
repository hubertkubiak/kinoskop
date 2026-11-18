import { genreCounts } from './genres';
import { bucketize, byCountDesc, isRated, type LibraryItem, personKey } from './model';

export interface Fact {
  id: string;
  text: string;
}

const fmt = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Automatically picked trivia for the dashboard (SPEC §7.1). Pure and deterministic. */
export function funFacts(items: LibraryItem[]): Fact[] {
  const rated = items.filter(isRated);
  if (rated.length < 10) return [];
  const facts: Fact[] = [];

  const genres = genreCounts(rated).filter((g) => g.count >= 5 && g.avg !== undefined);
  if (genres.length >= 3) {
    const byAvg = [...genres].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
    const worst = byAvg[0];
    const best = byAvg[byAvg.length - 1];
    facts.push({ id: 'harshest-genre', text: `Najsurowiej oceniasz gatunek ${worst.key} (śr. ${fmt(worst.avg!)}).` });
    facts.push({ id: 'best-genre', text: `Najwyżej oceniasz gatunek ${best.key} (śr. ${fmt(best.avg!)}).` });
  }

  const directors = new Map<string, string>();
  const dirBuckets = bucketize(rated, (it) =>
    (it.enrichment?.directors ?? []).map((d) => {
      const k = personKey(d);
      directors.set(k, d.name);
      return k;
    }),
  ).sort(byCountDesc);
  if (dirBuckets[0] && dirBuckets[0].count >= 3) {
    facts.push({
      id: 'top-director',
      text: `Najczęściej oglądany reżyser: ${directors.get(dirBuckets[0].key)} (${dirBuckets[0].count} tytułów).`,
    });
  }

  const tens = rated.filter((i) => i.rating === 10).length;
  if (tens) {
    facts.push({ id: 'tens', text: `„Dziesiątka” padła ${tens} razy – to ${fmt((tens / rated.length) * 100)}% ocen.` });
  }

  const weekday = bucketize(
    rated.filter((i) => i.ratedAt),
    (i) => [new Date(i.ratedAt!).getUTCDay()],
  ).sort(byCountDesc)[0];
  if (weekday) {
    const days = ['niedziele', 'poniedziałki', 'wtorki', 'środy', 'czwartki', 'piątki', 'soboty'];
    facts.push({ id: 'weekday', text: `Najczęściej oceniasz w ${days[weekday.key]}.` });
  }
  return facts;
}
