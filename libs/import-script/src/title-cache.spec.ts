import { describe, expect, it } from 'vitest';
import { TitleCache } from './title-cache';

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('TitleCache', () => {
  it('survives a reload: titles, empty answers and Wikidata ids', () => {
    const s = memoryStorage();
    const a = new TitleCache(s, 'k');
    a.set('film', 1, { title: 'Ręka', year: 1965 });
    a.set('film', 2, {});
    a.addWikidata([7, 8]);
    a.save();

    const b = new TitleCache(s, 'k');
    expect(b.get('film', 1)).toEqual({ title: 'Ręka', year: 1965 });
    expect(b.get('film', 2)).toEqual({});
    expect(b.get('film', 3)).toBeUndefined();
    expect(b.get('serial', 1)).toBeUndefined();
    expect(b.knownInWikidata(7)).toBe(true);
    expect(b.knownInWikidata(9)).toBe(false);
    expect(b.size).toBe(2);
  });

  it('ignores a corrupted or foreign entry and works without storage', () => {
    expect(new TitleCache(memoryStorage({ k: '{bad' }), 'k').size).toBe(0);
    expect(new TitleCache(memoryStorage({ k: '{"v":9}' }), 'k').size).toBe(0);
    const none = new TitleCache(null, 'k');
    none.set('game', 1, { title: 'x' });
    expect(() => none.save()).not.toThrow();
  });

  it('keeps working when storage is full', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
    const c = new TitleCache(full, 'k');
    c.set('film', 1, { title: 'x' });
    expect(() => c.save()).not.toThrow();
    expect(c.get('film', 1)).toEqual({ title: 'x' });
  });
});
