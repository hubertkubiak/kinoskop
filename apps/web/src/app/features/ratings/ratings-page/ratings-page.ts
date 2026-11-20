import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  agreementLabel,
  divergences,
  harshnessByYear,
  isRated,
  MIN_PUBLIC_VOTES,
  pearson,
  publicByMyRating,
  ratingBias,
  ratingVsPublic,
  trendPerYear,
} from '@kinoskop/stats';
import type { EChartsCoreOption } from 'echarts/core';
import { ChartCard } from '../../../charts/chart-card/chart-card';
import { ChartTheme } from '../../../charts/theme';
import { ApiClient } from '../../../core/api.client';
import { FiltersStore } from '../../../core/filters.store';
import { fmtAvg, fmtInt } from '../../../core/format';
import { Ticket } from '../../../ui/ticket/ticket';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtAvg(Math.abs(x))}`;

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
  readonly int = fmtInt;
  readonly pct = pct;
  readonly signed = signed;
  readonly minVotes = MIN_PUBLIC_VOTES;

  readonly points = computed(() => ratingVsPublic(this.fs.filtered()));
  readonly div = computed(() => divergences(this.points()));
  readonly bias = computed(() => ratingBias(this.points()));
  readonly agreement = computed(() => agreementLabel(this.bias()?.correlation));

  /** One sentence: more generous or stricter than the public, in points. */
  readonly verdict = computed(() => {
    const b = this.bias();
    if (!b) return '';
    const d = b.meanDiff;
    if (Math.abs(d) < 0.15) return 'Oceniasz praktycznie tak samo hojnie jak ogół widzów.';
    return d > 0
      ? `Oceniasz średnio o ${fmtAvg(d)} pkt łagodniej niż ogół widzów.`
      : `Oceniasz średnio o ${fmtAvg(-d)} pkt surowiej niż ogół widzów.`;
  });

  // --- "Co ogół sądzi o tytułach, którym dajesz…" ---------------------------------------
  readonly byMine = computed(() => publicByMyRating(this.points()));

  readonly byMineOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    const rows = this.byMine();
    return {
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0 },
      tooltip: {
        trigger: 'axis',
        formatter: (xs: { dataIndex: number }[]) => {
          const r = rows[xs[0]?.dataIndex ?? 0];
          return r.n
            ? `Twoja ocena ${r.rating}: ${r.n} tytułów<br/>średnia TMDB tych tytułów: ${fmtAvg(r.publicAvg)}`
            : `Twoja ocena ${r.rating}: brak tytułów`;
        },
      },
      xAxis: { type: 'category', name: 'Twoja ocena', nameLocation: 'middle', nameGap: 26, data: rows.map((r) => String(r.rating)) },
      yAxis: { type: 'value', min: 0, max: 10, name: 'Średnia TMDB' },
      series: [
        {
          name: 'Średnia TMDB tych tytułów',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: { color: p.accent },
          data: rows.map((r) => r.publicAvg ?? null),
        },
        {
          name: 'Gdyby ogół oceniał jak Ty',
          type: 'line',
          symbol: 'none',
          lineStyle: { color: p.muted, type: 'dashed' },
          data: rows.map((r) => r.rating),
        },
      ],
    };
  });
  readonly byMineTable = computed(() => ({
    columns: ['Twoja ocena', 'Tytułów', 'Średnia TMDB tych tytułów', 'Różnica (Ty − TMDB)'],
    rows: this.byMine().map((r) => [
      r.rating,
      r.n,
      r.publicAvg === undefined ? undefined : fmtAvg(r.publicAvg),
      r.publicAvg === undefined ? undefined : signed(r.rating - r.publicAvg),
    ]),
  }));

  // --- "Surowość w czasie" ---------------------------------------------------------------
  readonly harshness = computed(() => harshnessByYear(this.fs.filtered()));

  readonly harshnessOption = computed<EChartsCoreOption>(() => {
    const p = this.theme.palette();
    const rows = this.harshness();
    return {
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: rows.map((r) => String(r.year)) },
      yAxis: [
        { type: 'value', name: 'Średnia', min: 1, max: 10 },
        { type: 'value', name: 'Ty − TMDB', splitLine: { show: false } },
      ],
      series: [
        { name: 'Twoja średnia ocena', type: 'line', data: rows.map((r) => r.avg), itemStyle: { color: p.accent } },
        {
          name: 'Różnica względem TMDB',
          type: 'line',
          yAxisIndex: 1,
          data: rows.map((r) => r.diff ?? null),
          itemStyle: { color: p.cat[2] },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dashed' }, data: [{ yAxis: 0 }] },
        },
      ],
    };
  });
  readonly harshnessTable = computed(() => ({
    columns: ['Rok oceny', 'Ocen', 'Twoja średnia', 'Tytułów z oceną TMDB', 'Ty − TMDB'],
    rows: this.harshness().map((r) => [r.year, r.n, fmtAvg(r.avg), r.nPublic, r.diff === undefined ? undefined : signed(r.diff)]),
  }));

  /** Plain-language trend; uses the difference to TMDB when known (it ignores which titles were watched). */
  readonly harshnessVerdict = computed(() => {
    const rows = this.harshness();
    if (rows.length < 3) return '';
    const byDiff = trendPerYear(rows.map((r) => ({ year: r.year, value: r.diff })));
    const slope = byDiff ?? trendPerYear(rows.map((r) => ({ year: r.year, value: r.avg })));
    if (slope === undefined) return '';
    const span = rows[rows.length - 1].year - rows[0].year;
    const total = slope * span;
    const what = byDiff !== undefined ? 'w porównaniu z ogółem widzów' : 'średnio';
    if (Math.abs(total) < 0.3) return `Od ${rows[0].year} Twoja surowość jest stała – ${what} oceniasz podobnie jak dawniej.`;
    return total > 0
      ? `Łagodniejesz: od ${rows[0].year} oceniasz ${what} o ok. ${fmtAvg(total)} pkt wyżej niż na początku.`
      : `Twoje oceny są coraz surowsze: od ${rows[0].year} oceniasz ${what} o ok. ${fmtAvg(-total)} pkt niżej niż na początku.`;
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
      const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1] / s.scale));
      return { ...s, n: pairs.length, r, label2: agreementLabel(r) };
    });
    const best = out.filter((o) => o.r !== undefined && o.n >= 10).sort((a, b) => (b.r ?? 0) - (a.r ?? 0))[0];
    return { sources: out, closest: best?.label };
  });
}
