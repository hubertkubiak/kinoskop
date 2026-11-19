// Kinoskop – skrypt importu Twoich danych z Filmwebu.
// Co robi: czyta WYŁĄCZNIE Twoje oceny, daty ocen, ulubione i listę „chcę zobaczyć”
// (zapytania GET, jedno naraz, z przerwami), a na końcu zapisuje plik JSON na Twoim dysku.
// Niczego nie zmienia na Filmwebie i niczego nigdzie nie wysyła.

import {
  ALLOWED_HOST,
  BASE_FILE_MIN_TITLES,
  MAX_PAGES,
  PROGRESS_KEY,
  SCHEMA_VERSION,
  SCRIPT_VERSION,
  TITLE_CACHE_KEY,
  TITLE_INFO_MODE,
} from './config';
import { ENDPOINTS, FW_LISTS, type FwKind, type FwPathKind } from './endpoints';
import { BadRequestError, getJson, getRequestCount, NotLoggedInError, TooManyRequestsError } from './http';
import {
  dedupe,
  extractList,
  mapLoggedInfo,
  mapTitleInfo,
  mapVote,
  mapWant2see,
  type LoggedUser,
  type RawItem,
} from './mappers';
import { EtaMeter, fmtMinutes } from './eta';
import { TitleCache } from './title-cache';
import { knownInWikidata } from './wikidata';

const KINDS: FwKind[] = ['film', 'serial', 'game'];
const STYLE = 'color:#1A1306;background:#F0B23E;padding:2px 6px;border-radius:3px;font-weight:bold';

/** Panel postępu na stronie: konsola bywa czyszczona, a nie każdy na nią patrzy. */
function panel(): HTMLElement {
  let el = document.getElementById('kinoskop-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kinoskop-panel';
    el.setAttribute('role', 'status');
    el.style.cssText =
      'position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:360px;padding:12px 16px;' +
      'background:#1A1306;color:#F5EBDD;border:2px solid #F0B23E;border-radius:8px;' +
      'font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    document.body.appendChild(el);
  }
  return el;
}

let lastMsg = '';
const HIDDEN_NOTE = ' ⏸ Karta jest w tle – przeglądarka spowalnia import. Wróć do niej (może być w osobnym oknie).';

const log = (msg: string) => {
  lastMsg = msg;
  console.log(`%cKinoskop%c ${msg}`, STYLE, '');
  try {
    panel().textContent = `Kinoskop: ${msg}${document.visibilityState === 'hidden' ? HIDDEN_NOTE : ''}`;
  } catch {
    /* brak DOM – zostaje sama konsola */
  }
};

/** Ostrzeżenie przy próbie opuszczenia/przeładowania karty w trakcie importu. */
const keepAlive = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = '';
};

/**
 * Chrome spowalnia timery w kartach w tle (sprawdza je raz na sekundę, po 5 min nawet raz na minutę –
 * developer.chrome.com/blog/timer-throttling-in-chrome-88), a skrypt robi przerwy właśnie timerami.
 * Gdy karta znika z widoku, zmieniamy jej tytuł i panel, żeby było widać, że import zwolnił.
 */
let originalTitle = '';
const onVisibility = () => {
  if (document.visibilityState === 'hidden') {
    originalTitle = document.title;
    document.title = '⏸ Kinoskop – wróć do tej karty';
  } else if (originalTitle) {
    document.title = originalTitle;
  }
  log(lastMsg);
};

/** Stan zapisywany po każdej stronie, żeby ponowne uruchomienie pominęło pobrane dane. */
interface Progress {
  userId: number;
  done: string[]; // np. "votes:film:3", "info:game:123"
  items: RawItem[];
  errors: number;
  /** Filmweb ID filmów i seriali znanych Wikidata (tryb 'missing'); brak = jeszcze nie sprawdzono. */
  wdKnown?: number[];
}

function loadProgress(userId: number): Progress {
  try {
    const p = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) ?? 'null') as Progress | null;
    if (p && p.userId === userId) return p;
  } catch {
    /* uszkodzony zapis – zaczynamy od nowa */
  }
  return { userId, done: [], items: [], errors: 0 };
}

const saveProgress = (p: Progress) => sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(p));

/** Pobiera wszystkie strony listy; pomija strony pobrane wcześniej. */
async function fetchPages(
  p: Progress,
  name: 'votes' | 'want2see',
  list: { path: FwPathKind; kind: FwKind },
  map: (raw: unknown, kind: FwKind) => RawItem,
): Promise<void> {
  const { path, kind } = list;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const tag = `${name}:${path}:${page}`;
    if (p.done.includes(tag)) continue;
    if (p.done.includes(`${name}:${path}:end`)) return;
    let body: unknown;
    try {
      body = await getJson(ENDPOINTS[name](path, page));
    } catch (e) {
      if (!(e instanceof BadRequestError)) throw e;
      // Filmweb nie zna tej listy – pomijamy ją zamiast przerywać cały import.
      console.warn(`Kinoskop: lista ${name}/${path} niedostępna (400), pomijam.`);
      body = null;
    }
    const items = body === null ? [] : extractList(body);
    for (const raw of items) {
      try {
        p.items.push(map(raw, kind));
      } catch (e) {
        p.errors++;
        console.warn('Kinoskop: pominięto pozycję –', (e as Error).message);
      }
    }
    p.done.push(items.length === 0 ? `${name}:${path}:end` : tag);
    saveProgress(p);
    if (items.length === 0) return;
    log(`${p.items.length} pozycji… (${path}, strona ${page})`);
  }
}

/** Uzupełnia pozycje tytułami zapamiętanymi z poprzednich importów (bez zapytań). */
function applyCache(p: Progress, cache: TitleCache): number {
  let n = 0;
  for (const it of p.items) {
    if (it.title) {
      // Tytuł pobrany wcześniej w tym samym (wznowionym) imporcie – zapamiętujemy go na przyszłość.
      if (!cache.get(it.kind, it.filmwebId)) cache.set(it.kind, it.filmwebId, { title: it.title, originalTitle: it.originalTitle, year: it.year });
      continue;
    }
    if (p.done.includes(`info:${it.kind}:${it.filmwebId}`)) continue;
    const info = cache.get(it.kind, it.filmwebId);
    if (info) {
      Object.assign(it, info);
      p.done.push(`info:${it.kind}:${it.filmwebId}`);
      n++;
    }
  }
  return n;
}

/** Filmy i seriale bez tytułu, które Wikidata zna po Filmweb ID (wynik zapamiętany w postępie i w pamięci skryptu). */
async function wikidataKnown(p: Progress, cache: TitleCache): Promise<Set<number>> {
  if (p.wdKnown) return new Set(p.wdKnown);
  const candidates = [
    ...new Set(
      p.items
        .filter((it) => it.kind !== 'game' && !it.title && !p.done.includes(`info:${it.kind}:${it.filmwebId}`))
        .map((it) => it.filmwebId),
    ),
  ];
  const fromCache = candidates.filter((id) => cache.knownInWikidata(id));
  const ask = candidates.filter((id) => !cache.knownInWikidata(id));
  // Partie, których Wikidata nie sprawdziła mimo ponowień, nie są „znane” – dla nich pobierzemy info.
  const asked = await knownInWikidata(ask, (done, total) => log(`sprawdzam tytuły w Wikidata: ${done}/${total}…`));
  const known = new Set([...fromCache, ...asked.known]);
  cache.addWikidata(known);
  cache.save();
  p.wdKnown = [...known];
  saveProgress(p);
  log(
    `Wikidata zna ${known.size} z ${candidates.length} filmów i seriali bez tytułu; dla pozostałych pobiorę tytuł i rok.` +
      (asked.failed.length ? ` (Wikidata nie odpowiedziała dla ${asked.failed.length} – sprawdzę je na Filmwebie.)` : ''),
  );
  return known;
}

/** Pozycje, dla których trzeba pobrać info tytułu (patrz TITLE_INFO_MODE). */
async function titleInfoTodo(p: Progress, cache: TitleCache): Promise<RawItem[]> {
  if (TITLE_INFO_MODE === 'none') return [];
  const known = TITLE_INFO_MODE === 'missing' ? await wikidataKnown(p, cache) : new Set<number>();
  const needs = (it: RawItem) =>
    !it.title &&
    (it.kind === 'game' || TITLE_INFO_MODE === 'all' || (TITLE_INFO_MODE === 'missing' && !known.has(it.filmwebId)));
  return p.items.filter((it) => needs(it) && !p.done.includes(`info:${it.kind}:${it.filmwebId}`));
}

/** Dociąga tytuł i rok dla `todo`; każdy wynik trafia też do pamięci skryptu na kolejne importy. */
async function fetchTitleInfo(p: Progress, cache: TitleCache, todo: RawItem[]): Promise<void> {
  const eta = new EtaMeter();
  let n = 0;
  for (const it of todo) {
    const t0 = Date.now();
    const visibleAtStart = document.visibilityState === 'visible';
    try {
      const body = await getJson(ENDPOINTS.titleInfo(it.filmwebId));
      const info = body === null ? {} : mapTitleInfo(body);
      Object.assign(it, info);
      cache.set(it.kind, it.filmwebId, info);
    } catch (e) {
      if (e instanceof NotLoggedInError || e instanceof TooManyRequestsError) throw e;
      p.errors++;
    }
    eta.record(Date.now() - t0, visibleAtStart && document.visibilityState === 'visible');
    p.done.push(`info:${it.kind}:${it.filmwebId}`);
    n++;
    // Zapis co 10 pozycji: sessionStorage i localStorage przy kilku tysiącach pozycji nie są darmowe.
    if (n % 10 === 0 || n === todo.length) {
      saveProgress(p);
      cache.save();
      const left = eta.estimate(todo.length - n);
      const per = eta.estimate(1);
      log(
        `tytuły do dopasowania: ${n}/${todo.length}` +
          (left === undefined || per === undefined ? '' : `, zostało ${fmtMinutes(left)} (${(per / 1000).toFixed(1)} s na tytuł)`) +
          '. Nie zamykaj tej karty.',
      );
    }
  }
}

/** localStorage bywa zablokowany (tryb prywatny, ustawienia) – wtedy pamięć tytułów po prostu nie działa. */
function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function download(user: LoggedUser, items: RawItem[], part: 'base' | 'full'): string {
  const now = new Date();
  const file = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'filmweb',
    scriptVersion: SCRIPT_VERSION,
    part,
    user,
    items,
  };
  const day = now.toISOString().slice(0, 10);
  const name = part === 'base' ? `kinoskop-eksport-${day}-czesc-1.json` : `kinoskop-eksport-${day}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

/** Minimalne sprawdzenie wyniku; pełną walidację (Zod) robi aplikacja. */
function sanityCheck(items: RawItem[]): void {
  const bad = items.filter((it) => !Number.isInteger(it.filmwebId) || (it.rating !== undefined && (it.rating < 1 || it.rating > 10)));
  if (bad.length) throw new Error(`Niepoprawne pozycje: ${bad.length}`);
}

export async function run(): Promise<void> {
  if (location.hostname !== ALLOWED_HOST) {
    log(`uruchom mnie na https://${ALLOWED_HOST} (teraz jesteś na ${location.hostname}).`);
    return;
  }
  const started = Date.now();
  log(
    `start (wersja ${SCRIPT_VERSION}). Nie zamykaj ani nie przeładowuj tej karty i trzymaj ją na wierzchu ` +
      '(może być w osobnym oknie) – karty w tle przeglądarka spowalnia.',
  );
  window.addEventListener('beforeunload', keepAlive);
  document.addEventListener('visibilitychange', onVisibility);
  try {
    const user = mapLoggedInfo(await getJson(ENDPOINTS.loggedInfo()));
    const p = loadProgress(user.id);
    if (p.done.length) log(`wznawiam: mam już ${p.items.length} pozycji.`);
    for (const list of FW_LISTS) {
      await fetchPages(p, 'votes', list, mapVote);
      await fetchPages(p, 'want2see', list, mapWant2see);
    }
    const cache = new TitleCache(safeLocalStorage(), TITLE_CACHE_KEY);
    const reused = applyCache(p, cache);
    if (reused) log(`z poprzednich importów pamiętam tytuły ${reused} pozycji – nie pobieram ich ponownie.`);
    const todo = await titleInfoTodo(p, cache);
    let baseName: string | undefined;
    if (todo.length >= BASE_FILE_MIN_TITLES) {
      // Część 1: listy są kompletne, więc aplikacja może już liczyć statystyki; tytuły dojdą w części 2.
      const base = dedupe(p.items);
      sanityCheck(base);
      baseName = download(user, base, 'base');
      log(
        `zapisano część 1: ${baseName} – możesz ją już wczytać w Kinoskopie. Teraz pobieram tytuły ${todo.length} pozycji; ` +
          'na końcu zapiszę część 2 (jeśli przeglądarka zapyta o pobieranie wielu plików, zezwól).',
      );
    }
    await fetchTitleInfo(p, cache, todo);
    const items = dedupe(p.items);
    sanityCheck(items);
    const name = download(user, items, 'full');
    sessionStorage.removeItem(PROGRESS_KEY);
    const per = KINDS.map((k) => `${k}: ${items.filter((i) => i.kind === k).length}`).join(', ');
    const secs = Math.round((Date.now() - started) / 1000);
    log(
      `gotowe! ${items.length} pozycji (${per}), ${getRequestCount()} zapytań, ${secs} s, błędów: ${p.errors}. ` +
        (baseName
          ? `Zapisano część 2: ${name} – przeciągnij ją na stronę Kinoskopu; uzupełni wczytaną część 1 bez utraty danych.`
          : `Zapisano plik ${name} – przeciągnij go na stronę Kinoskopu.`),
    );
  } catch (e) {
    if (e instanceof NotLoggedInError) log('nie jesteś zalogowany. Zaloguj się na filmweb.pl i uruchom skrypt ponownie.');
    else if (e instanceof TooManyRequestsError) log('za dużo zapytań. Spróbuj za kilka minut – postęp zostanie wznowiony.');
    else log(`przerwano: ${(e as Error).message}. Uruchom ponownie – postęp zostanie wznowiony.`);
  } finally {
    window.removeEventListener('beforeunload', keepAlive);
    document.removeEventListener('visibilitychange', onVisibility);
    if (originalTitle && document.visibilityState === 'visible') document.title = originalTitle;
  }
}
