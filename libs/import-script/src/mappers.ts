// Mapowanie surowych odpowiedzi Filmwebu na pozycje eksportu.
// Kształt odpowiedzi potwierdzony 2026-11-19 (docs/filmweb-api.md). Mappery nadal akceptują kilka
// wariantów nazw pól i głośno zgłaszają nieznany kształt, bo API może się zmienić bez ostrzeżenia.

import type { FwKind } from './endpoints';

export interface RawItem {
  filmwebId: number;
  kind: FwKind;
  list: 'rated' | 'want2see';
  rating?: number;
  favorite?: boolean;
  ratedAt?: string;
  title?: string;
  originalTitle?: string;
  year?: number;
}

export interface LoggedUser {
  id: number;
  name: string;
}

/** Błąd mapowania z próbką kluczy, żeby użytkownik mógł zgłosić problem. */
export class ShapeError extends Error {
  constructor(what: string, sample: unknown) {
    const keys = sample && typeof sample === 'object' ? Object.keys(sample).join(', ') : typeof sample;
    super(`Nieznany format odpowiedzi (${what}); pola: ${keys}`);
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Zwraca pierwszą zdefiniowaną wartość spośród podanych pól. */
function pick(o: Obj, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

function toInt(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : undefined;
}

/** Data jako ISO: obsługuje znacznik czasu (s lub ms), liczbę RRRRMMDD i tekst ISO. */
export function toIsoDate(v: unknown): string | undefined {
  if (typeof v === 'number') {
    if (v >= 19000101 && v <= 21001231) {
      const s = String(v);
      return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))).toISOString();
    }
    const ms = v < 1e11 ? v * 1000 : v;
    return ms > 0 ? new Date(ms).toISOString() : undefined;
  }
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return undefined;
}

/** Wyciąga tablicę pozycji z odpowiedzi listy (tablica wprost albo opakowana). */
export function extractList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (isObj(body)) {
    const inner = pick(body, 'items', 'data', 'content', 'votes', 'results');
    if (Array.isArray(inner)) return inner;
  }
  throw new ShapeError('lista', body);
}

export function mapLoggedInfo(body: unknown): LoggedUser {
  if (!isObj(body)) throw new ShapeError('użytkownik', body);
  const id = toInt(pick(body, 'id', 'userId'));
  const name = pick(body, 'name', 'login', 'nick', 'displayName');
  if (id === undefined) throw new ShapeError('użytkownik', body);
  return { id, name: typeof name === 'string' ? name : String(id) };
}

/** Pole ID tytułu: liczba wprost albo zagnieżdżony obiekt. */
function entityId(o: Obj): number | undefined {
  const raw = pick(o, 'entity', 'filmId', 'titleId', 'id');
  if (isObj(raw)) return toInt(pick(raw, 'id'));
  return toInt(raw);
}

export function mapVote(raw: unknown, kind: FwKind): RawItem {
  if (!isObj(raw)) throw new ShapeError('ocena', raw);
  const filmwebId = entityId(raw);
  if (filmwebId === undefined) throw new ShapeError('ocena', raw);
  const rate = toInt(pick(raw, 'rate', 'rating', 'vote', 'value'));
  const item: RawItem = { filmwebId, kind, list: 'rated' };
  // Ocena 0 oznacza „widziane bez oceny”; takich nie zapisujemy jako oceny.
  if (rate !== undefined && rate >= 1 && rate <= 10) item.rating = rate;
  if (pick(raw, 'favorite', 'favourite', 'fav') === true) item.favorite = true;
  const date = toIsoDate(pick(raw, 'timestamp', 'date', 'viewDate', 'createdAt'));
  if (date) item.ratedAt = date;
  return item;
}

export function mapWant2see(raw: unknown, kind: FwKind): RawItem {
  if (!isObj(raw)) throw new ShapeError('chcę zobaczyć', raw);
  const filmwebId = entityId(raw);
  if (filmwebId === undefined) throw new ShapeError('chcę zobaczyć', raw);
  return { filmwebId, kind, list: 'want2see' };
}

/** Podstawowe info tytułu – wyłącznie tytuł, tytuł oryginalny i rok (do dopasowania). */
export function mapTitleInfo(body: unknown): Pick<RawItem, 'title' | 'originalTitle' | 'year'> {
  if (!isObj(body)) throw new ShapeError('info tytułu', body);
  const out: Pick<RawItem, 'title' | 'originalTitle' | 'year'> = {};
  const title = pick(body, 'title', 'name');
  const original = pick(body, 'originalTitle', 'originalName');
  const year = toInt(pick(body, 'year', 'releaseYear'));
  if (typeof title === 'string' && title) out.title = title;
  if (typeof original === 'string' && original && original !== title) out.originalTitle = original;
  if (year !== undefined && year >= 1870 && year <= 2100) out.year = year;
  return out;
}

/** Łączy pozycje: ta sama para (typ, ID) z obu list – zostaje ocena. */
export function dedupe(items: RawItem[]): RawItem[] {
  const byKey = new Map<string, RawItem>();
  for (const it of items) {
    const key = `${it.kind}:${it.filmwebId}`;
    const prev = byKey.get(key);
    if (!prev || (prev.list === 'want2see' && it.list === 'rated')) byKey.set(key, it);
  }
  return [...byKey.values()];
}
