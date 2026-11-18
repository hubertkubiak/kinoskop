import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  type Filters,
  filtersToParams,
  paramsToFilters,
} from '@kinoskop/stats';
import { LibraryStore } from './library.store';

/** Global filters (SPEC §7.0), stored in the URL query params so links keep the view. */
@Injectable({ providedIn: 'root' })
export class FiltersStore {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly library = inject(LibraryStore);
  private readonly params = toSignal(this.route.queryParams, { initialValue: {} });

  readonly filters = computed<Filters>(() => paramsToFilters(this.params() as Record<string, string>));
  readonly activeCount = computed(() => activeFilterCount(this.filters()));
  readonly filtered = computed(() => applyFilters(this.library.library(), this.filters()));
  readonly total = computed(() => this.library.library().length);

  update(patch: Partial<Filters>): void {
    const next = { ...this.filters(), ...patch };
    void this.router.navigate([], { queryParams: filtersToParams(next), replaceUrl: true });
  }

  reset(): void {
    this.update(EMPTY_FILTERS);
  }

  toggle<K extends keyof Filters>(key: K, value: Filters[K] extends (infer U)[] ? U : never): void {
    const list = this.filters()[key] as unknown[];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    this.update({ [key]: next } as Partial<Filters>);
  }
}
