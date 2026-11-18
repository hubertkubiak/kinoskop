import Bottleneck from 'bottleneck';
import { z } from 'zod';
import { fetchJson } from '../http/fetch-json';

/**
 * IGDB v4 client (api-docs.igdb.com): Twitch OAuth client credentials
 * (POST https://id.twitch.tv/oauth2/token), then POST https://api.igdb.com/v4/games with an
 * Apicalypse body and headers `Client-ID`, `Authorization: Bearer <token>`. Limit 4 req/s.
 * Cover URL: https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg
 */
const GameSchema = z.object({
  id: z.number(),
  name: z.string(),
  first_release_date: z.number().optional(),
  summary: z.string().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  themes: z.array(z.object({ name: z.string() })).optional(),
  involved_companies: z
    .array(z.object({ developer: z.boolean().optional(), company: z.object({ name: z.string(), country: z.number().optional() }) }))
    .optional(),
});
export type IgdbGame = z.infer<typeof GameSchema>;

const FIELDS =
  'fields name,first_release_date,summary,cover.image_id,genres.name,themes.name,involved_companies.developer,involved_companies.company.name;';

export class IgdbClient {
  private readonly limiter = new Bottleneck({ maxConcurrent: 4, minTime: 260 });
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  get enabled(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const p = new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials' });
    const res = await fetchJson<{ access_token: string; expires_in: number }>('twitch', `https://id.twitch.tv/oauth2/token?${p}`, {
      method: 'POST',
    });
    if (!res) throw new Error('Twitch token endpoint returned no body');
    this.token = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
    return res.access_token;
  }

  private query(body: string): Promise<IgdbGame[]> {
    return this.limiter.schedule(async () => {
      const raw = await fetchJson<unknown>('igdb', 'https://api.igdb.com/v4/games', {
        method: 'POST',
        body,
        headers: { 'Client-ID': this.clientId, Authorization: `Bearer ${await this.accessToken()}`, Accept: 'application/json' },
      });
      return z.array(GameSchema).parse(raw ?? []);
    });
  }

  search(name: string): Promise<IgdbGame[]> {
    const safe = name.replace(/["\\]/g, ' ');
    return this.query(`search "${safe}"; ${FIELDS} limit 10;`);
  }

  async byId(id: number): Promise<IgdbGame | null> {
    return (await this.query(`${FIELDS} where id = ${Math.trunc(id)};`))[0] ?? null;
  }
}

export const igdbCover = (g: IgdbGame) =>
  g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : undefined;

export const igdbYear = (g: IgdbGame) =>
  g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined;
