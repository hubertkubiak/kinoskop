import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { countryStats, nationalityStats, UNKNOWN } from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { hBar } from '../../charts/builders';
import { ChartCard } from '../../charts/chart-card';
import { ChartTheme } from '../../charts/theme';
import { FiltersStore } from '../../core/filters.store';
import { countryName, fmtAvg } from '../../core/format';

type Metric = 'count' | 'avg';

@Component({
  selector: 'ks-world-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCard],
  template: `
    <h1 class="font-display text-4xl uppercase mb-4">Świat</h1>
    <ks-chart-card heading="Kraje produkcji" [option]="mapOption()" [table]="countryTable()" height="420px"
      [empty]="!mapReady() || countries().length === 0" [emptyText]="mapReady() ? 'Brak danych o krajach.' : 'Ładuję mapę…'">
      <div slot="controls" class="flex gap-2 mb-2" role="radiogroup" aria-label="Miara">
        <button type="button" role="radio" class="ks-chip pr-3 text-xs" [attr.aria-checked]="metric() === 'count'"
          [class.!border-ks-accent]="metric() === 'count'" (click)="metric.set('count')">Liczba tytułów</button>
        <button type="button" role="radio" class="ks-chip pr-3 text-xs" [attr.aria-checked]="metric() === 'avg'"
          [class.!border-ks-accent]="metric() === 'avg'" (click)="metric.set('avg')">Średnia ocena</button>
      </div>
    </ks-chart-card>

    <div class="grid gap-4 xl:grid-cols-2 mt-4">
      <ks-chart-card heading="Ranking krajów" [option]="countryBars()" [table]="countryTable()" [height]="barsHeight(countries().length)" />
      <ks-chart-card heading="Narodowość twórców"
        subtitle="Wielokrotne obywatelstwo liczone dla każdego kraju; brak danych jako „nieznana”"
        [option]="natBars()" [table]="natTable()" [height]="barsHeight(nationalities().length)">
        <div slot="controls" class="flex gap-2 mb-2" role="tablist" aria-label="Rola">
          <button type="button" role="tab" class="ks-chip pr-3 text-xs" [attr.aria-selected]="role() === 'director'"
            [class.!border-ks-accent]="role() === 'director'" (click)="role.set('director')">Reżyserzy</button>
          <button type="button" role="tab" class="ks-chip pr-3 text-xs" [attr.aria-selected]="role() === 'cast'"
            [class.!border-ks-accent]="role() === 'cast'" (click)="role.set('cast')">Aktorzy (top 10 obsady)</button>
        </div>
      </ks-chart-card>
    </div>
    <p class="text-xs text-ks-muted mt-3">Mapa: Natural Earth (domena publiczna). Narodowości: Wikidata (P27).</p>
  `,
})
export class WorldPage {
  private readonly fs = inject(FiltersStore);
  private readonly theme = inject(ChartTheme);
  readonly metric = signal<Metric>('count');
  readonly role = signal<'director' | 'cast'>('director');
  readonly mapReady = signal(false);

  readonly countries = computed(() => countryStats(this.fs.filtered()));
  readonly nationalities = computed(() => nationalityStats(this.fs.filtered(), this.role()).slice(0, 30));

  constructor() {
    void this.loadMap();
  }

  private async loadMap() {
    const [{ echarts }, geo] = await Promise.all([
      import('../../charts/echarts-setup'),
      fetch('assets/geo/world.json').then((r) => r.json()),
    ]);
    if (!echarts.getMap('world')) echarts.registerMap('world', geo);
    this.mapReady.set(true);
  }

  barsHeight(n: number) {
    return `${Math.max(200, Math.min(n, 30) * 22 + 40)}px`;
  }

  readonly mapOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    const rows = this.countries();
    const isAvg = this.metric() === 'avg';
    const values = rows.map((r) => (isAvg ? (r.avg ?? 0) : r.count));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (x: { name: string; value: number }) =>
          `${countryName(x.name)}: ${Number.isFinite(x.value) ? (isAvg ? fmtAvg(x.value) : x.value) : '–'}`,
      },
      visualMap: {
        min: isAvg ? 1 : 0,
        max: isAvg ? 10 : Math.max(1, ...values),
        left: 8,
        bottom: 8,
        calculable: true,
        inRange: { color: p.seq },
        textStyle: { color: p.muted },
      },
      series: [
        {
          type: 'map',
          map: 'world',
          roam: true,
          itemStyle: { areaColor: p.surface2, borderColor: p.border },
          emphasis: { itemStyle: { areaColor: p.accentStrong }, label: { show: false } },
          data: rows.map((r, i) => ({ name: r.key, value: values[i] })),
        },
      ],
    };
  });

  readonly countryBars = computed(() => {
    const rows = this.countries().slice(0, 30);
    return hBar(this.theme.palette(), rows.map((r) => countryName(r.key)), rows.map((r) => r.count), {
      highlight: 0,
      labels: rows.map((r) => `${r.count} · śr. ${fmtAvg(r.avg)}`),
    });
  });

  readonly countryTable = computed(() => ({
    columns: ['Kraj', 'Tytuły', 'Średnia ocena'],
    rows: this.countries().map((r) => [countryName(r.key), r.count, r.avg]),
  }));

  readonly natBars = computed(() => {
    const p = this.theme.palette();
    const rows = this.nationalities();
    return hBar(p, rows.map((r) => countryName(r.key)), rows.map((r) => r.count), {
      colors: rows.map((r) => (r.key === UNKNOWN ? p.border : p.cat[2])),
      labels: rows.map((r) => `${r.count} · śr. ${fmtAvg(r.avg)}`),
    });
  });

  readonly natTable = computed(() => ({
    columns: ['Narodowość', 'Tytuły', 'Średnia ocena'],
    rows: this.nationalities().map((r) => [countryName(r.key), r.count, r.avg]),
  }));
}
