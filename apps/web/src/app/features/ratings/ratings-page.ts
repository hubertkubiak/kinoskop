import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  divergences,
  isRated,
  pearson,
  publicRatingDistribution,
  ratingDistribution,
  ratingVsPublic,
} from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { ratingHistogram } from '../../charts/builders';
import { ChartCard } from '../../charts/chart-card';
import { ChartTheme } from '../../charts/theme';
import { ApiClient } from '../../core/api.client';
import { FiltersStore } from '../../core/filters.store';
import { fmtAvg } from '../../core/format';
import { Ticket } from '../../ui/ticket';

@Component({
  selector: 'ks-ratings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCard, Ticket],
  templateUrl: './ratings-page.html',
})
export class RatingsPage {
  private readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);
  readonly api = inject(ApiClient);
  readonly avg = fmtAvg;

  readonly points = computed(() => ratingVsPublic(this.fs.filtered()));
  readonly div = computed(() => divergences(this.points()));

  readonly histOption = computed(() =>
    ratingHistogram(this.theme.palette(), [
      { name: 'Moje oceny', values: ratingDistribution(this.fs.filtered()) },
      { name: 'Średnia ogółu (TMDB, ≥ 50 głosów)', values: publicRatingDistribution(this.points()) },
    ]),
  );
  readonly histTable = computed(() => {
    const mine = ratingDistribution(this.fs.filtered());
    const pub = publicRatingDistribution(this.points());
    return { columns: ['Ocena', 'Moje', 'Ogół (TMDB)'], rows: mine.map((m, i) => [i + 1, m, pub[i]]) };
  });

  readonly scatterOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        formatter: (x: { data: [number, number, string] }) => `${x.data[2]}<br/>Ty: ${x.data[1]} · TMDB: ${x.data[0]}`,
      },
      xAxis: { type: 'value', name: 'TMDB', min: 1, max: 10 },
      yAxis: { type: 'value', name: 'Ty', min: 1, max: 10 },
      series: [
        {
          type: 'scatter',
          symbolSize: 7,
          itemStyle: { color: p.accent, opacity: 0.7 },
          data: this.points().map((pt) => [pt.public, pt.mine, pt.title]),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: p.muted, type: 'dashed' },
            data: [[{ coord: [1, 1] }, { coord: [10, 10] }]],
          },
        },
      ],
    };
  });
  readonly scatterTable = computed(() => ({
    columns: ['Tytuł', 'Moja ocena', 'TMDB'],
    rows: this.points().map((p) => [p.title, p.mine, p.public]),
  }));

  readonly correlation = computed(() => {
    const pts = this.points();
    return pearson(pts.map((p) => p.mine), pts.map((p) => p.public));
  });

  /** "Ty vs krytycy" (OMDb, optional): Pearson correlation with each source. */
  readonly critics = computed(() => {
    const rated = this.fs.filtered().filter(isRated);
    const sources = [
      { key: 'imdb', label: 'IMDb', scale: 1 },
      { key: 'rottenTomatoes', label: 'Rotten Tomatoes', scale: 10 },
      { key: 'metacritic', label: 'Metacritic', scale: 10 },
    ] as const;
    const out = sources.map((s) => {
      const pairs = rated
        .map((i) => [i.rating, i.enrichment?.critics?.[s.key]] as const)
        .filter((p): p is readonly [number, number] => p[1] !== undefined);
      return { ...s, n: pairs.length, r: pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1] / s.scale)) };
    });
    const best = out.filter((o) => o.r !== undefined && o.n >= 10).sort((a, b) => (b.r ?? 0) - (a.r ?? 0))[0];
    return { sources: out, closest: best?.label };
  });
}
