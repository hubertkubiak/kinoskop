import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { ERA_LABELS, type EraKey, KIND_LABELS, KINDS, type Kind, type ListKind } from '@kinoskop/shared';
import type { Range } from '@kinoskop/stats';
import { FiltersStore } from '../../core/filters.store';
import { Icon } from '../../ui/icon/icon';
import { AwardLabels } from '../../features/awards/award-labels';
import { FilterOptions, type Option } from '../filter-options';

/** Full filter editor. Renders inline under the header (acts as a bottom sheet on phones). */
@Component({
  selector: 'ks-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'block' },
  templateUrl: './filter-panel.html',
})
export class FilterPanel {
  readonly fs = inject(FiltersStore);
  readonly opts = inject(FilterOptions);
  readonly awardLabels = inject(AwardLabels);
  readonly closed = output<void>();

  readonly kinds = KINDS;
  readonly kindLabels = KIND_LABELS;
  readonly eraLabels = ERA_LABELS;
  readonly f = this.fs.filters;
  readonly personQuery = signal('');
  readonly showAllGenres = signal(false);

  readonly personMatches = computed<Option[]>(() => {
    const q = this.personQuery().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.opts
      .people()
      .filter((p) => p.label.toLowerCase().includes(q) && !this.f().people.includes(p.value))
      .slice(0, 8);
  });

  readonly visibleGenres = computed(() => (this.showAllGenres() ? this.opts.genres() : this.opts.genres().slice(0, 16)));

  constructor() {
    void this.awardLabels.load();
  }

  toggleKind(k: Kind) {
    this.fs.toggle('kinds', k);
  }
  toggleList(l: ListKind) {
    this.fs.toggle('lists', l);
  }
  toggleGenre(g: string) {
    this.fs.toggle('genres', g);
  }
  toggleCountry(c: string) {
    this.fs.toggle('countries', c);
  }
  toggleNationality(c: string) {
    this.fs.toggle('directorNationalities', c);
  }
  toggleEra(e: EraKey) {
    this.fs.toggle('eras', e);
  }
  toggleAward(a: string) {
    this.fs.toggle('awards', a);
  }

  addPerson(p: Option) {
    this.fs.update({ people: [...this.f().people, p.value] });
    this.personQuery.set('');
  }

  setRange(key: 'rating' | 'year', idx: 0 | 1, raw: string, bounds: Range) {
    const cur = this.f()[key] ?? bounds;
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const next: [number, number] = idx === 0 ? [v, Math.max(v, cur[1])] : [Math.min(v, cur[0]), v];
    const isFull = next[0] <= bounds[0] && next[1] >= bounds[1];
    this.fs.update({ [key]: isFull ? null : next });
  }

  setRatedAt(idx: 0 | 1, value: string) {
    const cur = this.f().ratedAt ?? ['1990-01-01', new Date().toISOString().slice(0, 10)];
    const next: [string, string] = idx === 0 ? [value, cur[1]] : [cur[0], value];
    this.fs.update({ ratedAt: value ? next : null });
  }

  isOn(list: readonly string[], v: string) {
    return list.includes(v);
  }
}
