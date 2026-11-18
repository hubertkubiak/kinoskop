import Bottleneck from 'bottleneck';
import { z } from 'zod';
import { fetchJson } from '../http/fetch-json';

/** OMDb (optional): https://www.omdbapi.com/?apikey=KEY&i=<imdb id>. Parsed defensively. */
const OmdbSchema = z.object({
  Response: z.string(),
  imdbRating: z.string().optional(),
  Metascore: z.string().optional(),
  Ratings: z.array(z.object({ Source: z.string(), Value: z.string() })).optional(),
});

export interface CriticsScores {
  imdb?: number;
  rottenTomatoes?: number;
  metacritic?: number;
}

export function parseOmdb(raw: unknown): CriticsScores | undefined {
  const r = OmdbSchema.safeParse(raw);
  if (!r.success || r.data.Response !== 'True') return undefined;
  const out: CriticsScores = {};
  const imdb = Number(r.data.imdbRating);
  if (Number.isFinite(imdb)) out.imdb = imdb;
  for (const rating of r.data.Ratings ?? []) {
    if (rating.Source === 'Rotten Tomatoes') {
      const v = parseInt(rating.Value, 10);
      if (Number.isFinite(v)) out.rottenTomatoes = v;
    }
  }
  const meta = Number(r.data.Metascore);
  if (Number.isFinite(meta)) out.metacritic = meta;
  return Object.keys(out).length ? out : undefined;
}

export class OmdbClient {
  // Free keys allow 1000 requests/day; stay gentle.
  private readonly limiter = new Bottleneck({ maxConcurrent: 2, minTime: 200 });
  constructor(private readonly key: string) {}

  get enabled(): boolean {
    return this.key.length > 0;
  }

  byImdbId(imdbId: string): Promise<CriticsScores | undefined> {
    return this.limiter.schedule(async () => {
      const p = new URLSearchParams({ apikey: this.key, i: imdbId });
      return parseOmdb(await fetchJson<unknown>('omdb', `https://www.omdbapi.com/?${p}`));
    });
  }
}
