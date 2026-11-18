import { computed, inject, Injectable } from '@angular/core';
import { ERA_KEYS, type EraKey } from '@kinoskop/shared';
import { genreCounts, personKey } from '@kinoskop/stats';
import { LibraryStore } from '../core/library.store';
import { countryName } from '../core/format';

export interface Option {
  value: string;
  label: string;
  count: number;
}

const sortOpts = (m: Map<string, Option>) =>
  [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl'));

/** Values available for each filter, derived from the user's library. */
@Injectable({ providedIn: 'root' })
export class FilterOptions {
  private readonly store = inject(LibraryStore);

  readonly genres = computed<Option[]>(() =>
    genreCounts(this.store.library()).map((g) => ({ value: g.key, label: g.key, count: g.count })),
  );

  readonly countries = computed(() => this.collect((e) => e.countries, countryName));

  readonly directorNationalities = computed(() =>
    this.collect((e) => e.directors.flatMap((d) => d.nationalities), countryName),
  );

  readonly eras = computed<EraKey[]>(() => {
    const present = new Set(this.store.library().flatMap((i) => i.enrichment?.setInPeriod ?? []).map((e) => e.key));
    return ERA_KEYS.filter((k) => present.has(k));
  });

  readonly people = computed<Option[]>(() => {
    const m = new Map<string, Option>();
    for (const it of this.store.library()) {
      for (const p of [...(it.enrichment?.directors ?? []), ...(it.enrichment?.cast ?? [])]) {
        const k = personKey(p);
        const o = m.get(k) ?? { value: k, label: p.name, count: 0 };
        o.count++;
        m.set(k, o);
      }
    }
    return sortOpts(m);
  });

  readonly awards = computed(() => this.collect((e) => e.awards.map((a) => a.awardKey), (k) => k));

  readonly yearBounds = computed<[number, number]>(() => {
    const years = this.store.library().map((i) => i.year ?? i.enrichment?.year).filter((y): y is number => !!y);
    return years.length ? [Math.min(...years), Math.max(...years)] : [1900, new Date().getFullYear()];
  });

  private collect(
    pick: (e: NonNullable<ReturnType<LibraryStore['library']>[number]['enrichment']>) => string[],
    label: (v: string) => string,
  ): Option[] {
    const m = new Map<string, Option>();
    for (const it of this.store.library()) {
      if (!it.enrichment) continue;
      for (const v of new Set(pick(it.enrichment))) {
        const o = m.get(v) ?? { value: v, label: label(v), count: 0 };
        o.count++;
        m.set(v, o);
      }
    }
    return sortOpts(m);
  }
}
