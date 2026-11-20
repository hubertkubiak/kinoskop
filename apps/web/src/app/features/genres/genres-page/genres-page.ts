import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KIND_LABELS, KINDS, type Kind } from '@kinoskop/shared';
import { genreCounts, genreShareByYear } from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { hBar } from '../../../charts/builders';
import { ChartCard } from '../../../charts/chart-card/chart-card';
import { ChartTheme } from '../../../charts/theme';
import { FiltersStore } from '../../../core/filters.store';
import { fmtAvg } from '../../../core/format';

@Component({
  selector: 'ks-genres-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCard],
  templateUrl: './genres-page.html',
  styleUrl: './genres-page.scss',
})
export class GenresPage {
  private readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);
  readonly kinds = KINDS;
  readonly labels = KIND_LABELS;
  readonly kind = signal<Kind>('film');

  private readonly items = computed(() => this.fs.filtered().filter((i) => i.kind === this.kind() && i.list === 'rated'));
  readonly rows = computed(() => genreCounts(this.items()));
  readonly top = computed(() => this.rows()[0]?.key);
  readonly share = computed(() => genreShareByYear(this.items()));
  readonly barHeight = computed(() => `${Math.max(220, this.rows().length * 24 + 40)}px`);

  readonly countOption = computed(() =>
    hBar(this.theme.palette(), this.rows().map((r) => r.key), this.rows().map((r) => r.count), { highlight: 0 }),
  );

  readonly avgOption = computed(() => {
    const p = this.theme.palette();
    const rows = [...this.rows()].filter((r) => r.avg !== undefined).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    return hBar(p, rows.map((r) => r.key), rows.map((r) => r.avg ?? 0), {
      colors: rows.map((r) => (r.reliable ? this.theme.ratingColor(r.avg) : p.border)),
      labels: rows.map((r) => `${fmtAvg(r.avg)} (${r.count})`),
    });
  });

  readonly treemapOption = computed<EChartsCoreOption>(() => ({
    tooltip: { formatter: '{b}: {c}' },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { color: this.theme.palette().accentInk },
        itemStyle: { borderColor: this.theme.palette().bg, borderWidth: 2 },
        data: this.rows().map((r, i) => ({
          name: r.key,
          value: r.count,
          itemStyle: { color: this.theme.palette().cat[i % 8] },
        })),
      },
    ],
  }));

  readonly countTable = computed(() => ({
    columns: ['Gatunek', 'Tytuły', 'Średnia ocena'],
    rows: this.rows().map((r) => [r.key, r.count, r.avg]),
  }));

  readonly shareOption = computed<EChartsCoreOption>(() => {
    const s = this.share();
    const p = this.theme.palette();
    return {
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v}%` },
      legend: { top: 0, type: 'scroll' },
      xAxis: { type: 'category', data: s.years.map(String), boundaryGap: false },
      yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      series: s.series.map((x, i) => ({
        name: x.genre,
        type: 'line',
        stack: 'share',
        areaStyle: { opacity: 0.85 },
        symbol: 'none',
        lineStyle: { width: 0 },
        color: x.genre === 'Inne' ? p.border : p.cat[i % 8],
        data: x.shares,
      })),
    };
  });

  readonly shareTable = computed(() => {
    const s = this.share();
    return { columns: ['Gatunek', ...s.years.map(String)], rows: s.series.map((x) => [x.genre, ...x.shares]) };
  });
}
