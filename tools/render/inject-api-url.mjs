#!/usr/bin/env node
/**
 * Post-build step for the Render Static Site (SPEC §8.4, docs/adr/0004).
 *
 * The `render` build configuration compiles the API base URL as the placeholder
 * "__KS_API_BASE_URL__". This script replaces it with KS_API_BASE_URL (e.g.
 * https://kinoskop-api.onrender.com) and adds that origin to the CSP connect-src in
 * index.html, which otherwise only allows 'self' and the AI providers.
 *
 * Usage: KS_API_BASE_URL=https://… node tools/render/inject-api-url.mjs [dist/apps/web/browser]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER = '__KS_API_BASE_URL__';
const dir = process.argv[2] ?? 'dist/apps/web/browser';
const raw = (process.env.KS_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

let url;
try {
  url = new URL(raw);
} catch {
  console.error('KS_API_BASE_URL must be the public URL of the API, e.g. https://kinoskop-api.onrender.com');
  process.exit(1);
}
if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
  console.error(`KS_API_BASE_URL must use https (got ${raw})`);
  process.exit(1);
}
const base = url.origin + url.pathname.replace(/\/+$/, '');

function* files(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (p.endsWith('.js')) yield p;
  }
}

let replaced = 0;
for (const f of files(dir)) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes(PLACEHOLDER)) continue;
  writeFileSync(f, src.split(PLACEHOLDER).join(base));
  replaced++;
}
if (!replaced) {
  console.error(`Placeholder ${PLACEHOLDER} not found in ${dir} – was the app built with --configuration=render?`);
  process.exit(1);
}

const indexPath = join(dir, 'index.html');
const html = readFileSync(indexPath, 'utf8');
const csp = html.replace(/connect-src 'self'/, `connect-src 'self' ${url.origin}`);
if (csp === html) {
  console.error('CSP connect-src not found in index.html');
  process.exit(1);
}
writeFileSync(indexPath, csp);
console.log(`API base URL set to ${base} in ${replaced} file(s); CSP connect-src allows ${url.origin}.`);
