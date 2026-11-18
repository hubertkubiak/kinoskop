import { Injectable, signal } from '@angular/core';
import {
  type AwardCatalog,
  AwardCatalogSchema,
  type ConfigResponse,
  ConfigResponseSchema,
  type EnrichRequestItem,
  type EnrichResponse,
  EnrichResponseSchema,
  type ManualMatchRequest,
  EnrichmentSchema,
  type Enrichment,
  type SearchQuery,
  type SearchResponse,
  SearchResponseSchema,
} from '@kinoskop/shared';
import type { z } from 'zod';
import { ENV } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin client for the Kinoskop API. It never sends ratings, user names or AI keys:
 * request bodies are built only from the typed request schemas in libs/shared.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly awake = signal<boolean | null>(null);
  readonly config = signal<ConfigResponse>({ criticsEnabled: false, gamesEnabled: false, tmdbEnabled: false });

  private async request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    const res = await fetch(`${ENV.apiBaseUrl}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) throw new ApiError(res.status, `API ${res.status}`);
    return schema.parse(await res.json());
  }

  /** Wakes the API (it may sleep on a free host, SPEC §8.4) and loads feature flags. */
  async warmUp(): Promise<void> {
    try {
      this.config.set(await this.request(ConfigResponseSchema, '/api/config'));
      this.awake.set(true);
    } catch {
      this.awake.set(false);
    }
  }

  enrich(items: EnrichRequestItem[]): Promise<EnrichResponse> {
    return this.request(EnrichResponseSchema, '/api/enrich', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  manualMatch(body: ManualMatchRequest): Promise<Enrichment> {
    return this.request(EnrichmentSchema, '/api/enrich/manual', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  search(q: SearchQuery): Promise<SearchResponse> {
    const p = new URLSearchParams({ q: q.q, kind: q.kind, ...(q.year ? { year: String(q.year) } : {}) });
    return this.request(SearchResponseSchema, `/api/search?${p}`);
  }

  awards(): Promise<AwardCatalog> {
    return this.request(AwardCatalogSchema, '/api/awards');
  }
}
