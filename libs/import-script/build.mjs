// Builds the console script (readable IIFE), the bookmarklet (minified) and the Phase 0 probe.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../dist/libs/import-script');
await mkdir(out, { recursive: true });

const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  logLevel: 'warning',
};

const banner = `// Kinoskop – skrypt importu. Kod jawny: przeczytaj go przed wklejeniem.\n// Działa tylko na https://www.filmweb.pl i wykonuje wyłącznie zapytania GET.`;

await build({
  ...common,
  entryPoints: [join(here, 'src/entry.ts')],
  outfile: join(out, 'kinoskop-import.js'),
  minify: false,
  banner: { js: banner },
});

await build({
  ...common,
  entryPoints: [join(here, 'src/entry.ts')],
  outfile: join(out, 'kinoskop-import.min.js'),
  minify: true,
});
const min = await readFile(join(out, 'kinoskop-import.min.js'), 'utf8');
await writeFile(join(out, 'kinoskop-bookmarklet.txt'), `javascript:${encodeURIComponent(min.trim())}`);

await build({
  ...common,
  entryPoints: [join(here, 'src/probe.ts')],
  outfile: join(out, 'kinoskop-sonda.js'),
  minify: false,
});

const lines = (await readFile(join(out, 'kinoskop-import.js'), 'utf8')).split('\n').length;
console.log(`import-script: kinoskop-import.js (${lines} lines), bookmarklet, probe → ${out}`);
