import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { KIND_LABELS, KINDS } from '@kinoskop/shared';
import { funFacts, kpis, ratingDistribution, ratingsOverTime } from '@kinoskop/stats';
import { ChartCard } from '../../../charts/chart-card/chart-card';
import { lineOverTime, ratingHistogram } from '../../../charts/builders';
import { ChartTheme } from '../../../charts/theme';
import { FiltersStore } from '../../../core/filters.store';
import { fmtAvg, fmtDuration, fmtInt } from '../../../core/format';
import { LibraryStore, NO_RATING_DATES_TEXT } from '../../../core/library.store';
import { KpiTile } from '../../../ui/kpi-tile/kpi-tile';

@Component({
  selector: 'ks-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiTile, ChartCard],
  templateUrl: './overview-page.html',
})
export class OverviewPage {
  private readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);
  private readonly store = inject(LibraryStore);
  readonly kinds = KINDS;
  readonly timeEmptyText = computed(() =>
    this.store.hasRatingDates() ? 'Brak danych dla wybranych filtrów.' : NO_RATING_DATES_TEXT,
  );
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
