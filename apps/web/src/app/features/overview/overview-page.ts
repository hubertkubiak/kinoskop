import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { KIND_LABELS, KINDS } from '@kinoskop/shared';
import { funFacts, kpis, ratingDistribution, ratingsOverTime } from '@kinoskop/stats';
import { ChartCard } from '../../charts/chart-card';
import { lineOverTime, ratingHistogram } from '../../charts/builders';
import { ChartTheme } from '../../charts/theme';
import { FiltersStore } from '../../core/filters.store';
import { fmtAvg, fmtDuration, fmtInt } from '../../core/format';
import { KpiTile } from '../../ui/kpi-tile';

@Component({
  selector: 'ks-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiTile, ChartCard],
  template: `
    <h1 class="font-display text-4xl uppercase mb-5">Przegląd</h1>
    @let k = kpi();
    <section aria-label="Najważniejsze liczby" class="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
      @for (kind of kinds; track kind) {
        <ks-kpi-tile [label]="'Ocenione: ' + labels[kind].many.toLowerCase()" [value]="fmt(k.ratedByKind[kind])"
          [hint]="k.topGenreByKind[kind] ? 'Top gatunek: ' + k.topGenreByKind[kind] : undefined" />
      }
      <ks-kpi-tile label="Chcę zobaczyć" [value]="fmt(k.want2see)" />
      <ks-kpi-tile label="Średnia ocena" [value]="avg(k.averageRating)" />
      <ks-kpi-tile label="Czas przed ekranem" [value]="screen()"
        [hint]="'Suma czasu ' + fmt(k.filmsWithRuntime) + ' filmów; seriale pominięte, bo nie wiadomo, ile odcinków obejrzano.'" />
      <ks-kpi-tile label="Ulubiona dekada" [value]="k.favouriteDecade ? k.favouriteDecade + 's' : '–'" hint="Najwyższa średnia (min. 5 ocen)" />
    </section>

    <div class="grid gap-4 lg:grid-cols-2 mb-6">
      <ks-chart-card heading="Oceny w czasie" subtitle="Liczba ocen miesięcznie" [option]="timeOption()" [table]="timeTable()"
        [empty]="time().length === 0" />
      <ks-chart-card heading="Rozkład ocen" [option]="distOption()" [table]="distTable()" [empty]="!k.averageRating" />
    </div>

    @if (facts().length) {
      <section class="ks-card p-5" aria-labelledby="ks-facts">
        <h2 id="ks-facts" class="font-display text-xl uppercase mb-3">Ciekawostki</h2>
        <ul class="grid gap-2 md:grid-cols-2">
          @for (f of facts(); track f.id) {
            <li class="flex gap-2"><span class="text-ks-accent" aria-hidden="true">◆</span> {{ f.text }}</li>
          }
        </ul>
      </section>
    }
  `,
})
export class OverviewPage {
  private readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);
  readonly kinds = KINDS;
  readonly labels = KIND_LABELS;
  readonly fmt = fmtInt;
  readonly avg = fmtAvg;

  readonly kpi = computed(() => kpis(this.fs.filtered()));
  readonly screen = computed(() => fmtDuration(this.kpi().screenTimeMinutes));
  readonly time = computed(() => ratingsOverTime(this.fs.filtered()));
  readonly dist = computed(() => ratingDistribution(this.fs.filtered()));
  readonly facts = computed(() => funFacts(this.fs.filtered()));

  readonly timeOption = computed(() =>
    lineOverTime(this.theme.palette(), this.time().map((t) => t.month), this.time().map((t) => t.count), { area: true, zoom: true }),
  );
  readonly timeTable = computed(() => ({
    columns: ['Miesiąc', 'Liczba ocen', 'Średnia'],
    rows: this.time().map((t) => [t.month, t.count, t.avg]),
  }));
  readonly distOption = computed(() => ratingHistogram(this.theme.palette(), [{ name: 'Moje oceny', values: this.dist() }]));
  readonly distTable = computed(() => ({
    columns: ['Ocena', 'Liczba'],
    rows: this.dist().map((c, i) => [i + 1, c]),
  }));
}
