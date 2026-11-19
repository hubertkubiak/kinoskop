// Pamięć skryptu między importami, w localStorage strony filmweb.pl (czyli tylko w Twojej przeglądarce).
// Trzyma tytuł i rok pobrane do dopasowania oraz ID, które Wikidata już zna. Dzięki temu kolejny
// import pobiera info tylko dla nowych ocen. Wyczyszczenie: localStorage.removeItem('kinoskop-titles-v1').

import type { FwKind } from './endpoints';
import type { RawItem } from './mappers';

export type TitleInfo = Pick<RawItem, 'title' | 'originalTitle' | 'year'>;

interface Stored {
  v: 1;
  /** "film:123" → [tytuł, tytuł oryginalny, rok]; puste pola = Filmweb nie podał. */
  titles: Record<string, [string?, string?, number?]>;
  /** Filmweb ID znane Wikidata (P5032) – dla nich nie trzeba pobierać info. */
  wd: number[];
}

const key = (kind: FwKind, id: number) => `${kind}:${id}`;

export class TitleCache {
  private data: Stored = { v: 1, titles: {}, wd: [] };
  private wd = new Set<number>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
    private readonly storageKey: string,
  ) {
    try {
      const raw = JSON.parse(storage?.getItem(storageKey) ?? 'null') as Stored | null;
      if (raw && raw.v === 1 && raw.titles && Array.isArray(raw.wd)) this.data = raw;
    } catch {
      /* uszkodzony zapis – zaczynamy od pustej pamięci */
    }
    this.wd = new Set(this.data.wd);
  }

  /** undefined = jeszcze nie pobierano; obiekt (może być pusty) = pobrane wcześniej. */
  get(kind: FwKind, id: number): TitleInfo | undefined {
    const row = this.data.titles[key(kind, id)];
    if (!row) return undefined;
    const [title, originalTitle, year] = row;
    return { ...(title ? { title } : {}), ...(originalTitle ? { originalTitle } : {}), ...(year ? { year } : {}) };
  }

  set(kind: FwKind, id: number, info: TitleInfo): void {
    this.data.titles[key(kind, id)] = [info.title, info.originalTitle, info.year];
  }

  knownInWikidata(id: number): boolean {
    return this.wd.has(id);
  }

  addWikidata(ids: Iterable<number>): void {
    for (const id of ids) this.wd.add(id);
  }

  get size(): number {
    return Object.keys(this.data.titles).length;
  }

  /** Zapis; przy braku miejsca (quota) pamięć po prostu nie działa – import idzie dalej. */
  save(): void {
    try {
      this.data.wd = [...this.wd];
      this.storage?.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      /* brak miejsca lub zablokowany localStorage */
    }
  }
}
