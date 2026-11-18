import type { SearchCandidate, SearchQuery } from '@kinoskop/shared';
import { igdbCover, igdbYear } from '../sources/igdb';
import { posterUrl } from '../sources/tmdb';
import type { Sources } from './pipeline';

/** Candidates for manual matching (GET /api/search). */
export async function searchCandidates(sources: Sources, q: SearchQuery): Promise<SearchCandidate[]> {
  if (q.kind === 'game') {
    if (!sources.igdb.enabled) return [];
    const games = await sources.igdb.search(q.q);
    return games.slice(0, 10).map((g) => ({
      kind: 'game' as const,
      igdbId: g.id,
      title: g.name,
      year: igdbYear(g),
      posterUrl: igdbCover(g),
      overview: g.summary?.slice(0, 300),
    }));
  }
  if (!sources.tmdb.enabled) return [];
  const results = await sources.tmdb.search(q.kind === 'serial' ? 'tv' : 'movie', q.q, q.year);
  return results.slice(0, 10).map((r) => {
    const date = r.release_date ?? r.first_air_date;
    return {
      kind: q.kind,
      tmdbId: r.id,
      title: r.title ?? r.name ?? '',
      originalTitle: r.original_title ?? r.original_name,
      year: date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined,
      posterUrl: posterUrl(r.poster_path, 'w185'),
      overview: r.overview?.slice(0, 300) || undefined,
    };
  });
}
