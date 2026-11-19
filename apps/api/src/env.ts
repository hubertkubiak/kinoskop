import { z } from 'zod';

/** Environment variables (SPEC §8.3). Validated at start-up with a readable error. */
const EnvSchema = z.object({
  TMDB_API_TOKEN: z.string().default(''),
  TWITCH_CLIENT_ID: z.string().default(''),
  TWITCH_CLIENT_SECRET: z.string().default(''),
  OMDB_API_KEY: z.string().default(''),
  WIKIDATA_CONTACT: z.string().min(3, 'WIKIDATA_CONTACT is required (e-mail or URL for the User-Agent)'),
  WEB_ORIGIN: z.url('WEB_ORIGIN must be a URL, e.g. http://localhost:4200'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('localhost'),
  CACHE_DB_PATH: z.string().default('./data/cache.sqlite'),
  NODE_ENV: z.string().default('development'),
  /** true behind a reverse proxy (Render): client IP for the rate limit comes from X-Forwarded-For. */
  TRUST_PROXY: z.stringbool().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration (see .env.example):\n${lines.join('\n')}`);
  }
  if (!parsed.data.TMDB_API_TOKEN) {
    console.warn('[kinoskop] TMDB_API_TOKEN is empty: enrichment will use Wikidata only.');
  }
  return parsed.data;
}

export const integrations = (env: Env) => ({
  wikidata: true,
  tmdb: env.TMDB_API_TOKEN.length > 0,
  igdb: env.TWITCH_CLIENT_ID.length > 0 && env.TWITCH_CLIENT_SECRET.length > 0,
  omdb: env.OMDB_API_KEY.length > 0,
});
