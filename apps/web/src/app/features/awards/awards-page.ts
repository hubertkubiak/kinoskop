import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { type Enrichment, itemKey, KIND_LABELS, KINDS, type Kind } from '@kinoskop/shared';
import { awardAffinity, awardTimeline, recommendations } from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { ChartCard } from '../../charts/chart-card';
import { ChartTheme } from '../../charts/theme';
import { ApiClient } from '../../core/api.client';
import { FiltersStore } from '../../core/filters.store';
import { LibraryStore } from '../../core/library.store';
import { fmtAvg } from '../../core/format';
import { Poster } from '../../ui/poster';
import { AwardLabels } from './award-labels';

/** SVG path of a bookmark, used for "want to see" points on the timeline. */
const BOOKMARK = 'path://M0,0 L10,0 L10,14 L5,10 L0,14 Z';

@Component({
  selector: 'ks-awards-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCard, Poster],
  templateUrl: './awards-page.html',
})
export class AwardsPage {
  private readonly fs = inject(FiltersStore);
  private readonly store = inject(LibraryStore);
  private readonly api = inject(ApiClient);
  private readonly theme = inject(ChartTheme);
  readonly labels = inject(AwardLabels);
  readonly kinds = KINDS;
  readonly kindLabels = KIND_LABELS;
  readonly avg = fmtAvg;
  readonly pct = (n?: number) => (n === undefined ? '–' : `${Math.round(n * 100)}%`);

  readonly kind = signal<Kind>('film');
  readonly nominations = signal(false);
  readonly recDetails = signal<ReadonlyMap<string, Enrichment>>(new Map());

  /** Catalogue limited to the selected type. */
  readonly catalog = computed(() => {
    const c = this.labels.catalog();
    if (!c) return null;
    const awards = c.awards.filter((a) => a.kind === this.kind());
    const keys = new Set(awards.map((a) => a.key));
    return { ...c, awards, entries: c.entries.filter((e) => keys.has(e.awardKey)) };
  });

  readonly affinity = computed(() => {
    const c = this.catalog();
    return c ? awardAffinity(this.fs.filtered(), c) : [];
  });
  readonly timeline = computed(() => {
    const c = this.catalog();
    return c ? awardTimeline(this.fs.filtered(), c, this.nominations()) : [];
  });
  readonly recs = computed(() => {
    const c = this.catalog();
    return c ? recommendations(this.store.library(), c, this.affinity()) : [];
  });

  constructor() {
    void this.labels.load();
    // Public metadata (poster, where to watch in PL) for recommended works with a Filmweb id.
    effect(() => {
      const ids = this.recs()
        .filter((r) => r.entry.work.filmwebId !== undefined && !r.inWant2see)
        .slice(0, 30)
        .map((r) => ({ filmwebId: r.entry.work.filmwebId!, kind: r.award.kind }));
      if (!ids.length || this.store.isDemo()) return;
      this.api
        .enrich(ids)
        .then((res) => this.recDetails.set(new Map(res.results.map((e) => [itemKey(e), e]))))
        .catch(() => undefined);
    });
  }

  names(list: { name: string }[]): string {
    return list.slice(0, 4).map((p) => p.name).join(', ');
  }

  details(filmwebId: number | undefined, kind: Kind): Enrichment | undefined {
    return filmwebId === undefined ? undefined : this.recDetails().get(`${kind}:${filmwebId}`);
  }

  readonly timelineOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    const awards = this.catalog()?.awards ?? [];
    const names = awards.map((a) => a.shortPl);
    const pts = this.timeline();
    const years = pts.map((x) => x.entry.year);
    const minYear = years.length ? Math.min(...years) : 1990;
    const maxYear = years.length ? Math.max(...years) : 2026;
    const series = (status: string, extra: object) => ({
      type: 'scatter',
      name: status,
      ...extra,
      data: pts
        .filter((x) => x.status === status)
        .map((x) => ({
          value: [x.entry.year, awards.indexOf(x.award)],
          title: x.entry.work.titlePl ?? x.entry.work.title,
          won: x.entry.won,
          rating: x.rating,
          itemStyle:
            status === 'watched'
              ? { color: this.theme.ratingColor(x.rating), borderColor: p.accentStrong, borderWidth: 1 }
              : undefined,
        })),
    });
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 50, containLabel: true },
      legend: { top: 0, data: ['watched', 'want2see', 'unwatched'], formatter: (n: string) => ({ watched: 'Obejrzane (kolor = ocena)', want2see: 'Chcę zobaczyć', unwatched: 'Nieobejrzane' })[n] ?? n },
      tooltip: {
        formatter: (x: { data: { title: string; value: [number, number]; won: boolean; rating?: number } }) =>
          `${x.data.title}<br/>${names[x.data.value[1]]} ${x.data.value[0]}${x.data.won ? '' : ' (nominacja)'}${x.data.rating ? `<br/>Twoja ocena: ${x.data.rating}` : ''}`,
      },
      xAxis: { type: 'value', min: minYear, max: maxYear, axisLabel: { formatter: (v: number) => String(v) } },
      yAxis: { type: 'category', data: names, inverse: true },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, height: 18, bottom: 8 }],
      series: [
        series('unwatched', { symbol: 'circle', symbolSize: 8, itemStyle: { color: 'transparent', borderColor: p.muted, borderWidth: 1 } }),
        series('want2see', { symbol: BOOKMARK, symbolSize: [9, 12], itemStyle: { color: p.cat[2] } }),
        series('watched', { symbol: 'circle', symbolSize: 11 }),
      ],
    };
  });

  readonly timelineTable = computed(() => ({
    columns: ['Nagroda', 'Rok', 'Tytuł', 'Laureat', 'Status', 'Twoja ocena'],
    rows: this.timeline().map((x) => [
      x.award.shortPl,
      x.entry.year,
      x.entry.work.titlePl ?? x.entry.work.title,
      x.entry.won ? 'tak' : 'nominacja',
      { watched: 'obejrzane', want2see: 'chcę zobaczyć', unwatched: 'nieobejrzane' }[x.status],
      x.rating,
    ]),
  }));

  readonly affinityOption = computed<EChartsCoreOption>(() => {
    const rows = this.affinity().filter((r) => r.delta !== undefined);
    return {
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', name: 'delta' },
      yAxis: { type: 'category', data: rows.map((r) => r.award.shortPl), inverse: true },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: rows.map((r) => ({ value: r.delta, itemStyle: { color: this.theme.deltaColor(r.delta ?? 0) } })),
          label: { show: true, position: 'right', color: this.theme.palette().muted, formatter: (x: { dataIndex: number }) => `n=${rows[x.dataIndex].n}` },
        },
      ],
    };
  });

  readonly affinityTable = computed(() => ({
    columns: ['Nagroda', 'Pokrycie', 'n', 'Średnia', 'Wynik', 'Delta', 'Trafność (≥ 8)'],
    rows: this.affinity().map((r) => [
      r.award.namePl,
      `${r.watched}/${r.winners}`,
      r.n,
      r.avg,
      r.insufficient ? 'za mało danych' : r.score,
      r.delta,
      this.pct(r.hitRate),
    ]),
  }));
}
