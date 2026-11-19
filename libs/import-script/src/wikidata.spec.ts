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
    expect(await p).toEqual({ known: new Set([5]), failed: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the batches that worked and reports the failed ones instead of giving up', async () => {
    vi.useFakeTimers();
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++call === 1 ? sparql(['1']) : ({ ok: false, status: 429, headers: new Headers({ 'retry-after': '1' }) }) as Response)),
    );
    const ids = Array.from({ length: WIKIDATA_BATCH + 2 }, (_, i) => i + 1);
    const p = knownInWikidata(ids);
    await vi.runAllTimersAsync();
    const r = await p;
    expect([...r.known]).toEqual([1]);
    expect(r.failed).toEqual([WIKIDATA_BATCH + 1, WIKIDATA_BATCH + 2]);
  });
});
