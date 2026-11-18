import { Injectable, signal } from '@angular/core';

/**
 * Shared ECharts theme (SPEC §9.3). Every colour is read from the CSS design tokens at runtime,
 * so charts follow the active theme and no component hard-codes a colour.
 */
export interface ChartPalette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentInk: string;
  positive: string;
  negative: string;
  neutral: string;
  seq: string[];
  cat: string[];
}

function readPalette(): ChartPalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v('--ks-bg'),
    surface: v('--ks-surface'),
    surface2: v('--ks-surface-2'),
    border: v('--ks-border'),
    text: v('--ks-text'),
    muted: v('--ks-text-muted'),
    accent: v('--ks-accent'),
    accentStrong: v('--ks-accent-strong'),
    accentInk: v('--ks-accent-ink'),
    positive: v('--ks-positive'),
    negative: v('--ks-negative'),
    neutral: v('--ks-neutral'),
    seq: [1, 2, 3, 4, 5].map((i) => v(`--ks-seq-${i}`)),
    cat: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--ks-cat-${i}`)),
  };
}

function buildTheme(p: ChartPalette): Record<string, unknown> {
  const axis = {
    axisLine: { lineStyle: { color: p.border } },
    axisTick: { lineStyle: { color: p.border } },
    axisLabel: { color: p.muted, fontFamily: 'Inter' },
    splitLine: { lineStyle: { color: p.border, opacity: 0.5 } },
    nameTextStyle: { color: p.muted },
  };
  return {
    color: p.cat,
    backgroundColor: 'transparent',
    textStyle: { color: p.text, fontFamily: 'Inter' },
    title: { textStyle: { color: p.text } },
    legend: { textStyle: { color: p.muted } },
    tooltip: {
      backgroundColor: p.surface2,
      borderColor: p.border,
      textStyle: { color: p.text },
      extraCssText: 'border-radius:6px;box-shadow:none;',
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    visualMap: { textStyle: { color: p.muted } },
    dataZoom: {
      textStyle: { color: p.muted },
      borderColor: p.border,
      fillerColor: `${p.accent}26`,
      handleStyle: { color: p.accent },
    },
  };
}

@Injectable({ providedIn: 'root' })
export class ChartTheme {
  readonly palette = signal<ChartPalette>(readPalette());
  readonly theme = signal<Record<string, unknown>>(buildTheme(this.palette()));

  /** Re-read tokens after a theme switch. */
  refresh(): void {
    const p = readPalette();
    this.palette.set(p);
    this.theme.set(buildTheme(p));
  }

  /** Colour for a rating 1–10 on the sequential scale. */
  ratingColor(rating: number | undefined): string {
    const seq = this.palette().seq;
    if (rating === undefined) return this.palette().neutral;
    const idx = Math.min(seq.length - 1, Math.max(0, Math.floor(((rating - 1) / 9) * (seq.length - 1) + 0.5)));
    return seq[idx];
  }

  /** Diverging colour for a delta (negative ↔ neutral ↔ positive). */
  deltaColor(delta: number): string {
    const p = this.palette();
    return delta > 0 ? p.positive : delta < 0 ? p.negative : p.neutral;
  }
}
