import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Provider } from '@kinoskop/shared';
import { displayTitle, type LibraryItem, tasteProfile, tasteScore } from '@kinoskop/stats';
import { FiltersStore } from '../../../core/filters.store';
import { LibraryStore } from '../../../core/library.store';
import { fmtAvg } from '../../../core/format';
import { Poster } from '../../../ui/poster/poster';

type SortKey = 'taste' | 'public' | 'year' | 'runtime';
const SERVICES_KEY = 'myServices';

function originalIfDifferent(item: LibraryItem): string | undefined {
  const o = item.enrichment?.originalTitle ?? item.originalTitle;
  return o && o !== displayTitle(item) ? o : undefined;
}

interface Row {
  item: LibraryItem;
  title: string;
  /** Original title when it differs from the displayed one (helps to recognise the title). */
  original?: string;
  score?: number;
  providers: { type: string; list: Provider[] }[];
}

@Component({
  selector: 'ks-want2see-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, Poster],
  templateUrl: './want2see-page.html',
})
export class Want2seePage {
  private readonly fs = inject(FiltersStore);
  private readonly store = inject(LibraryStore);
  readonly avg = fmtAvg;
  readonly sort = signal<SortKey>('taste');
  readonly onlyMine = signal(false);
  readonly myServices = signal<number[]>([]);

  constructor() {
    void this.store.getKv<number[]>(SERVICES_KEY).then((v) => v && this.myServices.set(v));
  }

  private readonly profile = computed(() => tasteProfile(this.store.library()));
  private readonly items = computed(() => this.fs.filtered().filter((i) => i.list === 'want2see'));

  /** Every provider seen in the list, for the "my services" picker. */
  readonly allServices = computed(() => {
    const m = new Map<number, Provider>();
    for (const i of this.items()) for (const p of i.enrichment?.providersPL?.flatrate ?? []) m.set(p.id, p);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  });

  readonly rows = computed<Row[]>(() => {
    const profile = this.profile();
    let rows: Row[] = this.items().map((item) => {
      const pp = item.enrichment?.providersPL;
      return {
        item,
        title: displayTitle(item),
        original: originalIfDifferent(item),
        score: tasteScore(item, profile),
        providers: pp
          ? [
              { type: 'Abonament', list: pp.flatrate },
              { type: 'Wypożyczenie', list: pp.rent },
              { type: 'Zakup', list: pp.buy },
            ].filter((x) => x.list.length)
          : [],
      };
    });
    if (this.onlyMine()) {
      const mine = new Set(this.myServices());
      rows = rows.filter((r) => (r.item.enrichment?.providersPL?.flatrate ?? []).some((p) => mine.has(p.id)));
    }
    const key = this.sort();
    const val = (r: Row): number =>
      key === 'taste'
        ? (r.score ?? -1)
        : key === 'public'
          ? (r.item.enrichment?.publicRating?.tmdb ?? -1)
          : key === 'year'
            ? (r.item.year ?? r.item.enrichment?.year ?? 0)
            : -(r.item.enrichment?.runtimeMinutes ?? 9999);
    return rows.sort((a, b) => val(b) - val(a));
  });

  readonly trackRow = (_: number, r: Row) => r.item.key;

  toggleService(id: number): void {
    const cur = this.myServices();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    this.myServices.set(next);
    void this.store.setKv(SERVICES_KEY, next);
  }
}
