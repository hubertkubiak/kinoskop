import { afterEach, describe, expect, it, vi } from 'vitest';
import { knownInWikidata, sparqlKnownIds, WIKIDATA_BATCH } from './wikidata';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const sparql = (ids: string[]) =>
  ({ ok: true, status: 200, json: async () => ({ results: { bindings: ids.map((v) => ({ fw: { value: v } })) } }) }) as unknown as Response;

describe('knownInWikidata', () => {
  it('builds a P5032 VALUES query with quoted ids', () => {
    expect(sparqlKnownIds([1, 22])).toContain('VALUES ?fw { "1" "22" }');
    expect(sparqlKnownIds([1])).toContain('/prop/direct/P5032>');
  });

  it('asks in batches and returns the ids Wikidata knows', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => sparql(['5']));
    vi.stubGlobal('fetch', fetch);
    const ids = Array.from({ length: WIKIDATA_BATCH + 1 }, (_, i) => i + 1);
    const p = knownInWikidata(ids);
    await vi.runAllTimersAsync();
    expect([...(await p)]).toEqual([5]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after repeated failures so the caller can fall back', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, headers: new Headers() }) as Response));
    const p = knownInWikidata([1]);
    const check = expect(p).rejects.toThrow('Wikidata');
    await vi.runAllTimersAsync();
    await check;
  });
});
