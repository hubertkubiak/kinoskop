import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { downloadCsv } from '../../core/format';
import { Icon } from '../../ui/icon/icon';
import { ChartTheme } from '../theme';

export interface ChartTable {
  columns: string[];
  rows: (string | number | undefined)[][];
}

let uid = 0;

/**
 * Card with a chart and its accessible table alternative ("Pokaż jako tabelę") + CSV export.
 * ECharts itself is loaded lazily when the first chart enters the viewport.
 */
@Component({
  selector: 'ks-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, Icon],
  host: { class: 'block ks-card p-4' },
  templateUrl: './chart-card.html',
  styleUrl: './chart-card.scss',
})
export class ChartCard {
  readonly theme = inject(ChartTheme);
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly option = input.required<EChartsCoreOption>();
  readonly table = input<ChartTable>();
  readonly height = input('300px');
  readonly empty = input(false);
  readonly emptyText = input('Brak danych dla wybranych filtrów.');
  readonly asTable = signal(false);
  readonly chartClick = signal<unknown>(null);
  readonly headingId = `ks-chart-${++uid}`;

  readonly filename = computed(() => `kinoskop-${this.heading().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, '-')}.csv`);

  csv(): void {
    const t = this.table();
    if (t) downloadCsv(this.filename(), t.columns, t.rows);
  }
}
