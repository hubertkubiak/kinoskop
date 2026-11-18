import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from './app';
import { SqliteCacheStore } from './cache/cache-store';
import { loadEnv } from './env';
import { IgdbClient } from './sources/igdb';
import { OmdbClient } from './sources/omdb';
import { TmdbClient } from './sources/tmdb';
import { WikidataClient } from './wikidata/client';

async function main() {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const env = loadEnv();

  const cache = new SqliteCacheStore(env.CACHE_DB_PATH);
  const app = await buildApp({
    env,
    cache,
    sources: {
      wikidata: new WikidataClient(env.WIKIDATA_CONTACT),
      tmdb: new TmdbClient(env.TMDB_API_TOKEN),
      igdb: new IgdbClient(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET),
      omdb: new OmdbClient(env.OMDB_API_KEY),
    },
  });

  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[ ready ] http://${env.HOST}:${env.PORT}`);

  const shutdown = async () => {
    await app.close();
    cache.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
