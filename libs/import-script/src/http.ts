// Zapytania do Filmwebu: wyłącznie GET, jedno naraz, z przerwami i ponawianiem.

import { DELAY_MS, MAX_ATTEMPTS } from './config';

export class NotLoggedInError extends Error {}
export class TooManyRequestsError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Losowa przerwa „jak u człowieka”. */
export const humanPause = () => sleep(DELAY_MS.min + Math.random() * (DELAY_MS.max - DELAY_MS.min));

let requestCount = 0;
export const getRequestCount = () => requestCount;

/**
 * Pobiera JSON spod ścieżki na tej samej domenie.
 * 401/403 → NotLoggedInError; 429 → kończymy (nie przyspieszamy); 5xx → do 3 prób z backoffem.
 * 404 → null (np. brak listy danego typu).
 */
export async function getJson(path: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    await humanPause();
    requestCount++;
    let res: Response;
    try {
      res = await fetch(path, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new NotLoggedInError();
    if (res.status === 429) throw new TooManyRequestsError();
    if (res.status === 404) return null;
    if (res.status >= 500) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`Błąd serwera ${res.status} dla ${path}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 204) return null;
    return res.json();
  }
}
