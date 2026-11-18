import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { downloadCsv } from '../core/format';
import { Icon } from '../ui/icon';
import { ChartTheme } from './theme';

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
  template: `
    <div class="flex items-start justify-between gap-3 mb-2">
      <div>
        <h2 [id]="headingId" class="font-display text-xl uppercase tracking-wide">{{ heading() }}</h2>
        @if (subtitle()) { <p class="text-xs text-ks-muted">{{ subtitle() }}</p> }
      </div>
      @if (table()) {
        <div class="flex gap-1 shrink-0">
          <button type="button" class="ks-btn text-xs !px-2 !py-1" [attr.aria-pressed]="asTable()" (click)="asTable.set(!asTable())">
            <ks-icon name="table" [size]="14" /> {{ asTable() ? 'Pokaż wykres' : 'Pokaż jako tabelę' }}
          </button>
          @if (asTable()) {
            <button type="button" class="ks-btn text-xs !px-2 !py-1" (click)="csv()" aria-label="Pobierz CSV">
              <ks-icon name="download" [size]="14" /> CSV
            </button>
          }
        </div>
      }
    </div>
    <ng-content select="[slot=controls]" />
    @if (asTable() && table(); as t) {
      <div class="overflow-auto" [style.max-height]="height()">
        <table class="ks-table" [attr.aria-labelledby]="headingId">
          <thead><tr>@for (c of t.columns; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
          <tbody>
            @for (r of t.rows; track $index) {
              <tr>@for (v of r; track $index) { <td>{{ v ?? '–' }}</td> }</tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (empty()) {
      <p class="text-sm text-ks-muted py-8 text-center">{{ emptyText() }}</p>
    } @else {
      @defer (on viewport) {
        <div echarts [options]="option()" [theme]="theme.theme()" [autoResize]="true" [style.height]="height()"
          role="img" [attr.aria-label]="heading() + ' – wykres; dane dostępne w widoku tabeli'"
          (chartClick)="chartClick.set($event)"></div>
      } @placeholder {
        <div [style.height]="height()"></div>
      }
    }
    <ng-content />
  `,
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
