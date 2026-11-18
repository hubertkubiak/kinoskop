import { AwardCatalogSchema } from '@kinoskop/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeTitle } from '../enrich/matching';
import { AWARDS } from './awards.config';

/**
 * Phase 4 acceptance: winners of the last 20 years of Best Picture and Palme d'Or are complete
 * in the generated catalogue (apps/api/src/assets/awards.json, built by `pnpm awards:refresh`).
 */
const root = join(__dirname, '../../../..');
const catalog = AwardCatalogSchema.parse(JSON.parse(readFileSync(join(root, 'apps/api/src/assets/awards.json'), 'utf8')));
const reference = JSON.parse(readFileSync(join(root, 'fixtures/awards/reference.json'), 'utf8')) as Record<string, string[] | string>;

const loose = (a: string, b: string) => {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
};

describe('award catalogue completeness', () => {
  it('uses only configured awards', () => {
    expect(catalog.awards.map((a) => a.key)).toEqual(AWARDS.map((a) => a.key));
  });

  for (const key of ['oscar-picture', 'palme-dor']) {
    it(`contains all reference winners of ${key}`, () => {
      const winners = catalog.entries.filter((e) => e.awardKey === key && e.won);
      const missing = (reference[key] as string[]).filter(
        (title) => !winners.some((w) => loose(w.work.title, title) || (w.work.titlePl && loose(w.work.titlePl, title))),
      );
      expect(missing).toEqual([]);
    });
  }
});
