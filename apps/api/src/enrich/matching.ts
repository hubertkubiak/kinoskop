/** Title matching used when Wikidata has no mapping (SPEC §8.2 p.3). Pure functions. */

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(s: string): string[] {
  const t = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient on character bigrams of normalised titles (0–1). */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  const counts = new Map<string, number>();
  for (const g of ba) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of bb) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(g, c - 1);
    }
  }
  return (2 * overlap) / (ba.length + bb.length);
}

export interface MatchQuery {
  titles: string[];
  year?: number;
}

export interface MatchCandidate {
  titles: string[];
  year?: number;
}

/** 1 for the same year, 0.8 for ±1, 0 otherwise; 0.5 when either year is unknown. */
export function yearScore(a?: number, b?: number): number {
  if (a === undefined || b === undefined) return 0.5;
  const d = Math.abs(a - b);
  return d === 0 ? 1 : d === 1 ? 0.8 : 0;
}

/** Confidence 0–1: best title similarity (75%) and year agreement (25%). */
export function matchConfidence(q: MatchQuery, c: MatchCandidate): number {
  let sim = 0;
  for (const a of q.titles) for (const b of c.titles) sim = Math.max(sim, titleSimilarity(a, b));
  return Math.round((sim * 0.75 + yearScore(q.year, c.year) * 0.25) * 100) / 100;
}

export function bestMatch<T extends MatchCandidate>(q: MatchQuery, candidates: T[]): { candidate: T; confidence: number } | null {
  let best: { candidate: T; confidence: number } | null = null;
  for (const c of candidates) {
    const confidence = matchConfidence(q, c);
    if (!best || confidence > best.confidence) best = { candidate: c, confidence };
  }
  return best;
}

/** Below this, a search hit is discarded as "unmatched". */
export const MIN_ACCEPTED_CONFIDENCE = 0.5;
