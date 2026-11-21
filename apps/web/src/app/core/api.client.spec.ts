import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichment } from '../testing/fixtures';
import { ApiClient, ApiError } from './api.client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ApiClient', () => {
  let api: ApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({});
    api = TestBed.inject(ApiClient);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('warmUp loads feature flags and marks the API awake', async () => {
    fetchMock.mockResolvedValue(json({ criticsEnabled: true, gamesEnabled: false, tmdbEnabled: true }));
    await api.warmUp();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/config');
    expect(api.awake()).toBe(true);
    expect(api.config().tmdbEnabled).toBe(true);
  });

  it('warmUp marks the API asleep on network errors and bad responses', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await api.warmUp();
    expect(api.awake()).toBe(false);
    fetchMock.mockResolvedValueOnce(json({ unexpected: true }));
    await api.warmUp();
    expect(api.awake()).toBe(false);
  });

  it('enrich posts only the request items as JSON and validates the reply', async () => {
    fetchMock.mockResolvedValue(json({ results: [enrichment(1)], errors: [], cacheHits: 0 }));
    const res = await api.enrich([{ filmwebId: 1, kind: 'film' }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/enrich');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ items: [{ filmwebId: 1, kind: 'film' }] });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(res.results[0].filmwebId).toBe(1);
  });

  it('throws ApiError with the status for non-2xx responses', async () => {
    fetchMock.mockResolvedValue(json({ error: 'rate' }, 429));
    await expect(api.enrich([{ filmwebId: 1, kind: 'film' }])).rejects.toEqual(new ApiError(429, 'API 429'));
  });

  it('search encodes the query in the URL', async () => {
    fetchMock.mockResolvedValue(json({ candidates: [] }));
    expect(await api.search({ q: 'Ziemia obiecana', kind: 'film', year: 1975 })).toEqual({ candidates: [] });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=Ziemia+obiecana&kind=film&year=1975');
  });
});
