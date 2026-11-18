// Kinoskop – SONDA (Faza 0). Jednorazowe narzędzie dla autora projektu.
// Wywołuje kandydackie endpointy z endpoints.ts (po jednej stronie każdej listy
// i info dla 2–3 tytułów każdego typu) i zapisuje surowe odpowiedzi do pliku,
// żeby potwierdzić ścieżki i kształt danych. Tylko GET, jedno zapytanie naraz.
// Nazwa i ID użytkownika są maskowane w zapisanym pliku.

import { ALLOWED_HOST } from './config';
import { ENDPOINTS, type FwKind } from './endpoints';
import { humanPause } from './http';

interface Sample {
  path: string;
  status: number;
  contentType: string | null;
  body: unknown;
}

async function probe(path: string): Promise<Sample> {
  await humanPause();
  try {
    const res = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 2000);
    }
    return { path, status: res.status, contentType: res.headers.get('content-type'), body };
  } catch (e) {
    return { path, status: -1, contentType: null, body: String(e) };
  }
}

/** Wyciąga do 3 ID tytułów z dowolnej odpowiedzi listy (pierwsze liczby w polach „entity”/„id”). */
function sampleIds(body: unknown): number[] {
  const list = Array.isArray(body) ? body : [];
  return list
    .map((o) => (o && typeof o === 'object' ? (o as Record<string, unknown>) : {}))
    .map((o) => Number(o['entity'] ?? o['id'] ?? NaN))
    .filter((n) => Number.isInteger(n))
    .slice(0, 3);
}

async function main() {
  if (location.hostname !== ALLOWED_HOST) {
    console.log(`Kinoskop sonda: uruchom na https://${ALLOWED_HOST}`);
    return;
  }
  const samples: Sample[] = [];
  const info = await probe(ENDPOINTS.loggedInfo());
  samples.push(info);
  for (const kind of ['film', 'serial', 'game'] as FwKind[]) {
    const votes = await probe(ENDPOINTS.votes(kind, 1));
    samples.push(votes, await probe(ENDPOINTS.votes(kind, 2)));
    samples.push(await probe(ENDPOINTS.want2see(kind, 1)));
    for (const id of sampleIds(votes.body)) samples.push(await probe(ENDPOINTS.titleInfo(id)));
    console.log(`Kinoskop sonda: ${kind} – gotowe`);
  }

  // Maskowanie danych identyfikujących autora (nazwa i ID użytkownika).
  let json = JSON.stringify({ probedAt: new Date().toISOString(), samples }, null, 2);
  const user = info.body as { id?: unknown; name?: unknown } | null;
  if (user && typeof user.name === 'string' && user.name.length > 2) json = json.split(user.name).join('ANON_USER');
  if (user && user.id !== undefined) json = json.split(`"id": ${String(user.id)}`).join('"id": 1');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `kinoskop-sonda-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  console.log('Kinoskop sonda: zapisano plik. Sprawdź go przed udostępnieniem.');
}

void main();
