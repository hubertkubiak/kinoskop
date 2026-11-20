import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ERA_LABELS, KIND_LABELS } from '@kinoskop/shared';
import type { Filters } from '@kinoskop/stats';
import { FiltersStore } from '../../core/filters.store';
import { countryName, fmtInt } from '../../core/format';
import { Icon } from '../../ui/icon/icon';
import { FilterOptions } from '../filter-options';
import { FilterPanel } from '../filter-panel/filter-panel';
import { AwardLabels } from '../../features/awards/award-labels';

interface Chip {
  id: string;
  label: string;
  remove: Partial<Filters>;
}

/** Removable filter chips with the "Pasuje: X z Y" counter (SPEC §7.0). */
@Component({
  selector: 'ks-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, FilterPanel],
  templateUrl: './filter-bar.html',
})
export class FilterBar {
  readonly fs = inject(FiltersStore);
  private readonly options = inject(FilterOptions);
  private readonly awardLabels = inject(AwardLabels);
  readonly open = signal(false);
  readonly fmt = fmtInt;

  readonly chips = computed<Chip[]>(() => {
    const f = this.fs.filters();
    const out: Chip[] = [];
    const listChip = <K extends keyof Filters>(key: K, values: string[], label: (v: string) => string) => {
      for (const v of values) {
        out.push({
          id: `${key}:${v}`,
          label: label(v),
          remove: { [key]: values.filter((x) => x !== v) } as Partial<Filters>,
        });
      }
    };
    listChip('kinds', f.kinds, (k) => KIND_LABELS[k as keyof typeof KIND_LABELS].many);
    listChip('lists', f.lists, (l) => (l === 'rated' ? 'Ocenione' : 'Chcę zobaczyć'));
    if (f.rating) out.push({ id: 'rating', label: `Ocena ${f.rating[0]}–${f.rating[1]}`, remove: { rating: null } });
    if (f.year) out.push({ id: 'year', label: `Rok ${f.year[0]}–${f.year[1]}`, remove: { year: null } });
    if (f.ratedAt) out.push({ id: 'ratedAt', label: `Ocenione ${f.ratedAt[0]} – ${f.ratedAt[1]}`, remove: { ratedAt: null } });
    listChip('genres', f.genres, (g) => (f.genreMode === 'all' ? `+ ${g}` : g));
    listChip('countries', f.countries, (c) => `Kraj: ${countryName(c)}`);
    listChip('directorNationalities', f.directorNationalities, (c) => `Reżyser: ${countryName(c)}`);
    listChip('eras', f.eras, (e) => ERA_LABELS[e as keyof typeof ERA_LABELS] ?? e);
    if (f.erasCertainOnly) out.push({ id: 'erasCertain', label: 'Tylko pewne epoki', remove: { erasCertainOnly: false } });
    const people = new Map(this.options.people().map((p) => [p.value, p.label]));
    listChip('people', f.people, (p) => people.get(p) ?? p);
    listChip('awards', f.awards, (a) => `${f.awardMode === 'won' ? 'Laureat' : 'Nominacja'}: ${this.awardLabels.short(a)}`);
    if (f.favorite) out.push({ id: 'fav', label: 'Ulubione', remove: { favorite: false } });
    return out;
  });
}
