import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  ConfigResponseSchema,
  EnrichRequestSchema,
  EnrichResponseSchema,
  EnrichmentSchema,
  HealthResponseSchema,
  ManualMatchRequestSchema,
  SearchQuerySchema,
  SearchResponseSchema,
} from '@kinoskop/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { loadCatalog, type LoadedCatalog } from './awards/catalog';
import type { CacheStore } from './cache/cache-store';
import { EnrichmentPipeline, type Sources } from './enrich/pipeline';
import { type Env, integrations } from './env';
import { searchCandidates } from './enrich/search';

export interface AppDeps {
  env: Env;
  cache: CacheStore;
  sources: Sources;
  catalog?: LoadedCatalog;
  logger?: boolean;
}

export const API_VERSION = '0.1.0';

/**
 * Builds the API. Privacy (SPEC §8.2, §14.4): request bodies are never logged, only method,
 * route and status; nothing user-related is cached. No LLM keys exist on the server.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger === false ? false : {
      level: 'info',
      serializers: {
        // Log only the route path – no query strings (titles) and no bodies.
        req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
    bodyLimit: 256 * 1024,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cors, { origin: deps.env.WEB_ORIGIN, methods: ['GET', 'POST'] });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  const catalog = deps.catalog ?? loadCatalog();
  const pipeline = new EnrichmentPipeline(deps.sources, deps.cache, catalog.lookup);
  const active = integrations(deps.env);

  app.get('/api/health', { schema: { response: { 200: HealthResponseSchema } } }, async () => {
    const generated = Date.parse(catalog.catalog.generatedAt);
    const valid = generated > 0;
    return {
      status: 'ok' as const,
      version: API_VERSION,
      awardsCatalog: {
        generatedAt: valid ? catalog.catalog.generatedAt : null,
        ageHours: valid ? Math.round((Date.now() - generated) / 36e5) : null,
      },
      integrations: active,
    };
  });

  app.get('/api/config', { schema: { response: { 200: ConfigResponseSchema } } }, async () => ({
    criticsEnabled: active.omdb,
    gamesEnabled: active.igdb,
    tmdbEnabled: active.tmdb,
  }));

  app.post(
    '/api/enrich',
    {
      schema: { body: EnrichRequestSchema, response: { 200: EnrichResponseSchema } },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req) => pipeline.enrich(req.body.items),
  );

  app.post(
    '/api/enrich/manual',
    { schema: { body: ManualMatchRequestSchema, response: { 200: EnrichmentSchema } } },
    async (req, reply) => {
      const { filmwebId, kind, tmdbId, igdbId } = req.body;
      const e = await pipeline.manual(filmwebId, kind, { tmdbId, igdbId });
      if (!e) throw Object.assign(new Error('Not found'), { statusCode: 404 });
      return reply.send(e);
    },
  );

  app.get('/api/search', { schema: { querystring: SearchQuerySchema, response: { 200: SearchResponseSchema } } }, async (req) => ({
    candidates: await searchCandidates(deps.sources, req.query),
  }));

  app.get('/api/awards', async (req, reply) => {
    reply.header('ETag', catalog.etag).header('Cache-Control', 'public, max-age=86400').type('application/json');
    if (req.headers['if-none-match'] === catalog.etag) return reply.code(304).send();
    return reply.send(catalog.json);
  });

  return app;
}
