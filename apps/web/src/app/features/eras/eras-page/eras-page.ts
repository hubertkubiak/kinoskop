import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ERA_LABELS } from '@kinoskop/shared';
import { activityHeatmap, decadeBuckets, eraStats } from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { AiErasPanel } from '../../../ai/ai-eras-panel/ai-eras-panel';
import { ChartCard } from '../../../charts/chart-card/chart-card';
import { ChartTheme } from '../../../charts/theme';
import { FiltersStore } from '../../../core/filters.store';
import { fmtAvg } from '../../../core/format';

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

@Component({
  selector: 'ks-eras-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCard, AiErasPanel],
  templateUrl: './eras-page.html',
  styleUrl: './eras-page.scss',
})
export class ErasPage {
  readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);

  readonly eras = computed(() => eraStats(this.fs.filtered(), this.fs.filters().erasCertainOnly));
  readonly decades = computed(() => decadeBuckets(this.fs.filtered()));
  readonly heat = computed(() => activityHeatmap(this.fs.filtered()));
  readonly heatHeight = computed(() => `${Math.max(200, this.heat().years.length * 26 + 60)}px`);

  readonly eraSubtitle = computed(() => {
    const s = this.eras();
    return `Nieustalona: ${s.undetermined}${s.notEnriched ? ` · bez dopasowania: ${s.notEnriched}` : ''}`;
  });

  readonly eraOption = computed<EChartsCoreOption>(() => {
    const rows = this.eras().eras;
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (x: { dataIndex: number }[]) => {
          const r = rows[x[0].dataIndex];
          return `${ERA_LABELS[r.key]}<br/>${r.count} tytułów · śr. ${fmtAvg(r.avg)}`;
        },
      },
      xAxis: { type: 'category', data: rows.map((r) => ERA_LABELS[r.key]), axisLabel: { rotate: 35 } },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          barMaxWidth: 36,
          data: rows.map((r) => ({ value: r.count, itemStyle: { color: this.theme.ratingColor(r.avg) } })),
        },
      ],
    };
  });

  readonly eraTable = computed(() => ({
    columns: ['Epoka', 'Tytuły', 'Średnia ocena'],
    rows: [
      ...this.eras().eras.map((r) => [ERA_LABELS[r.key], r.count, r.avg]),
      ['Nieustalona', this.eras().undetermined, undefined],
    ],
  }));

  readonly decadeOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    const rows = this.decades();
    return {
      grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      xAxis: { type: 'category', data: rows.map((r) => `${r.key}s`) },
      yAxis: [{ type: 'value' }, { type: 'value', min: 1, max: 10, splitLine: { show: false } }],
      series: [
        { name: 'Tytuły', type: 'bar', data: rows.map((r) => r.count), itemStyle: { color: p.cat[2] }, barMaxWidth: 28 },
        { name: 'Średnia ocena', type: 'line', yAxisIndex: 1, data: rows.map((r) => r.avg ?? null), lineStyle: { color: p.accent }, itemStyle: { color: p.accent } },
      ],
    };
  });

  readonly decadeTable = computed(() => ({
    columns: ['Dekada', 'Tytuły', 'Średnia ocena'],
    rows: this.decades().map((r) => [`${r.key}s`, r.count, r.avg]),
  }));

  readonly heatOption = computed<EChartsCoreOption>(() => {
    const h = this.heat();
    const p = this.theme.palette();
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 50, containLabel: true },
      tooltip: { formatter: (x: { data: [number, number, number] }) => `${MONTHS[x.data[0]]} ${h.years[x.data[1]]}: ${x.data[2]}` },
      xAxis: { type: 'category', data: MONTHS, splitArea: { show: false } },
      yAxis: { type: 'category', data: h.years.map(String) },
      visualMap: {
        min: 0,
        max: Math.max(1, ...h.cells.map((c) => c[2])),
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: p.seq },
      },
      series: [{ type: 'heatmap', data: h.cells, itemStyle: { borderColor: p.bg, borderWidth: 2 } }],
    };
  });

  readonly heatTable = computed(() => {
    const h = this.heat();
    return {
      columns: ['Rok', ...MONTHS],
      rows: h.years.map((y, yi) => [y, ...MONTHS.map((_, m) => h.cells.find((c) => c[0] === m && c[1] === yi)?.[2] ?? 0)]),
    };
  });
}
