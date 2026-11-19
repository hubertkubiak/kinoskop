// Kinoskop – skrypt importu Twoich danych z Filmwebu.
// Co robi: czyta WYŁĄCZNIE Twoje oceny, daty ocen, ulubione i listę „chcę zobaczyć”
// (zapytania GET, jedno naraz, z przerwami), a na końcu zapisuje plik JSON na Twoim dysku.
// Niczego nie zmienia na Filmwebie i niczego nigdzie nie wysyła.

import { ALLOWED_HOST, MAX_PAGES, PROGRESS_KEY, SCHEMA_VERSION, SCRIPT_VERSION, TITLE_INFO_MODE } from './config';
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

const log = (msg: string) => {
  console.log(`%cKinoskop%c ${msg}`, STYLE, '');
  try {
    panel().textContent = `Kinoskop: ${msg}`;
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
 * Chrome spowalnia timery w kartach w tle (po kilku minutach nawet do 1 na minutę), a skrypt robi
 * przerwy między zapytaniami właśnie timerami. Ostrzegamy, gdy karta przestaje być widoczna.
 */
const onHidden = () => {
  if (document.visibilityState === 'hidden')
    console.warn('Kinoskop: karta w tle – przeglądarka może spowolnić import. Wróć do niej albo przenieś ją do osobnego okna.');
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

/** Filmy i seriale bez tytułu, które Wikidata zna po Filmweb ID (wynik zapamiętany w postępie). */
async function wikidataKnown(p: Progress): Promise<Set<number>> {
  if (p.wdKnown) return new Set(p.wdKnown);
  const ids = [...new Set(p.items.filter((it) => it.kind !== 'game' && !it.title).map((it) => it.filmwebId))];
  try {
    const known = await knownInWikidata(ids, (done, total) => log(`sprawdzam tytuły w Wikidata: ${done}/${total}…`));
    p.wdKnown = [...known];
    saveProgress(p);
    log(`Wikidata zna ${known.size} z ${ids.length} filmów i seriali; dla pozostałych pobiorę tytuł i rok.`);
    return known;
  } catch (e) {
    // Bez Wikidata nie wiemy, czego brakuje – pobieramy info dla wszystkich (wolniej, ale nic nie ginie).
    console.warn('Kinoskop:', (e as Error).message);
    log('Wikidata nie odpowiada – pobiorę tytuł i rok dla wszystkich pozycji (to potrwa dłużej).');
    return new Set();
  }
}

const fmtMinutes = (ms: number) => (ms < 90_000 ? 'ok. 1 min' : `ok. ${Math.round(ms / 60_000)} min`);

/** Dociąga tytuł i rok tam, gdzie są potrzebne do dopasowania (patrz TITLE_INFO_MODE). */
async function fetchTitleInfo(p: Progress): Promise<void> {
  if (TITLE_INFO_MODE === 'none') return;
  const known = TITLE_INFO_MODE === 'missing' ? await wikidataKnown(p) : new Set<number>();
  const needs = (it: RawItem) =>
    !it.title &&
    (it.kind === 'game' || TITLE_INFO_MODE === 'all' || (TITLE_INFO_MODE === 'missing' && !known.has(it.filmwebId)));
  const todo = p.items.filter((it) => needs(it) && !p.done.includes(`info:${it.kind}:${it.filmwebId}`));
  const started = Date.now();
  let n = 0;
  for (const it of todo) {
    try {
      const body = await getJson(ENDPOINTS.titleInfo(it.filmwebId));
      if (body !== null) Object.assign(it, mapTitleInfo(body));
    } catch (e) {
      if (e instanceof NotLoggedInError || e instanceof TooManyRequestsError) throw e;
      p.errors++;
    }
    p.done.push(`info:${it.kind}:${it.filmwebId}`);
    n++;
    // Zapis co 10 pozycji: sessionStorage przy kilku tysiącach pozycji nie jest darmowy.
    if (n % 10 === 0 || n === todo.length) {
      saveProgress(p);
      const left = ((Date.now() - started) / n) * (todo.length - n);
      log(`tytuły do dopasowania: ${n}/${todo.length}, zostało ${fmtMinutes(left)}. Nie zamykaj tej karty.`);
    }
  }
}

function download(user: LoggedUser, items: RawItem[]): string {
  const now = new Date();
  const file = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'filmweb',
    scriptVersion: SCRIPT_VERSION,
    user,
    items,
  };
  const name = `kinoskop-eksport-${now.toISOString().slice(0, 10)}.json`;
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
  document.addEventListener('visibilitychange', onHidden);
  try {
    const user = mapLoggedInfo(await getJson(ENDPOINTS.loggedInfo()));
    const p = loadProgress(user.id);
    if (p.done.length) log(`wznawiam: mam już ${p.items.length} pozycji.`);
    for (const list of FW_LISTS) {
      await fetchPages(p, 'votes', list, mapVote);
      await fetchPages(p, 'want2see', list, mapWant2see);
    }
    await fetchTitleInfo(p);
    const items = dedupe(p.items);
    sanityCheck(items);
    const name = download(user, items);
    sessionStorage.removeItem(PROGRESS_KEY);
    const per = KINDS.map((k) => `${k}: ${items.filter((i) => i.kind === k).length}`).join(', ');
    const secs = Math.round((Date.now() - started) / 1000);
    log(
      `gotowe! ${items.length} pozycji (${per}), ${getRequestCount()} zapytań, ${secs} s, błędów: ${p.errors}. ` +
        `Zapisano plik ${name} – przeciągnij go na stronę Kinoskopu.`,
    );
  } catch (e) {
    if (e instanceof NotLoggedInError) log('nie jesteś zalogowany. Zaloguj się na filmweb.pl i uruchom skrypt ponownie.');
    else if (e instanceof TooManyRequestsError) log('za dużo zapytań. Spróbuj za kilka minut – postęp zostanie wznowiony.');
    else log(`przerwano: ${(e as Error).message}. Uruchom ponownie – postęp zostanie wznowiony.`);
  } finally {
    window.removeEventListener('beforeunload', keepAlive);
    document.removeEventListener('visibilitychange', onHidden);
  }
}
