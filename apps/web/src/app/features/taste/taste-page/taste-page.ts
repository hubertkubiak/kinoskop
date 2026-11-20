import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type Affinity, type AffinityKind, collaboratorsOf, directorActorDuos, tasteAffinities } from '@kinoskop/stats';
import { FiltersStore } from '../../../core/filters.store';
import { countryName, fmtAvg } from '../../../core/format';
import { Poster } from '../../../ui/poster/poster';
import { Ticket } from '../../../ui/ticket/ticket';

const KINDS: { kind: AffinityKind; label: string }[] = [
  { kind: 'genre', label: 'Gatunki' },
  { kind: 'country', label: 'Kraje produkcji' },
  { kind: 'director', label: 'Reżyserzy' },
  { kind: 'cast', label: 'Aktorzy' },
];
const PER_KIND = 6;
const MIN_TITLES = 5;

/**
 * "Twój gust" (SPEC §7.8, docs/adr/0002): ranked lists of what goes together with the user's
 * higher and lower ratings, director–actor duos and – with ?siec=<person> – a creator's collaborators.
 */
@Component({
  selector: 'ks-taste-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Poster, RouterLink, Ticket],
  templateUrl: './taste-page.html',
})
export class TastePage {
  private readonly fs = inject(FiltersStore);
  private readonly router = inject(Router);
  readonly avg = fmtAvg;
  readonly abs = Math.abs;
  readonly minTitles = MIN_TITLES;

  /** Person key from ?siec=… (creator card → "Pokaż współpracowników"). */
  readonly siec = input<string>();

  readonly aff = computed(() => tasteAffinities(this.fs.filtered(), MIN_TITLES));
  readonly sides = computed(() => {
    const a = this.aff();
    const group = (rows: Affinity[]) =>
      KINDS.map((k) => ({ ...k, rows: rows.filter((r) => r.kind === k.kind).slice(0, PER_KIND) }));
    return [
      { title: 'Podnosi Twoje oceny', groups: group(a.boosts) },
      { title: 'Obniża Twoje oceny', groups: group(a.drags) },
    ];
  });
  readonly duos = computed(() => directorActorDuos(this.fs.filtered(), 3).slice(0, 16));
  readonly network = computed(() => {
    const key = this.siec();
    return key ? collaboratorsOf(this.fs.filtered(), key) : null;
  });

  label(a: Affinity): string {
    return a.kind === 'country' ? countryName(a.label) : a.label;
  }

  round(x: number | undefined): number | undefined {
    return x === undefined ? undefined : Math.round(x);
  }

  titlesText(titles: { title: string; rating?: number }[]): string {
    return titles.map((t) => (t.rating ? `${t.title} (${t.rating})` : t.title)).join(', ');
  }

  openNetwork(key: string): void {
    void this.router.navigate(['/gust'], { queryParams: { siec: key }, queryParamsHandling: 'merge' });
  }
}
