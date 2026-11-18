/**
 * `pnpm awards:refresh` – rebuilds apps/api/src/assets/awards.json from Wikidata.
 * Run locally or from a weekly GitHub Action (SPEC §8.4 p.3); the API only serves the file.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WikidataClient } from '../wikidata/client';
import { AWARDS } from './awards.config';
import { buildAwardCatalog } from './build-catalog';

async function main() {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const contact = process.env['WIKIDATA_CONTACT'];
  if (!contact) throw new Error('Set WIKIDATA_CONTACT (e-mail or URL for the Wikidata User-Agent).');

  console.log('Building award catalogue from Wikidata…');
  const catalog = await buildAwardCatalog(new WikidataClient(contact), AWARDS);
  const out = join(process.cwd(), 'apps/api/src/assets/awards.json');
  writeFileSync(out, JSON.stringify(catalog) + '\n');
  console.log(`Wrote ${catalog.entries.length} entries to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
