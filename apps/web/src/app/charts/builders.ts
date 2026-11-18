import type { EChartsCoreOption } from 'echarts/core';
import type { ChartPalette } from './theme';

const baseGrid = { left: 8, right: 16, top: 16, bottom: 8, containLabel: true };

/** Horizontal bar chart (categories on Y, sorted top-down). */
export function hBar(
  p: ChartPalette,
  categories: string[],
  values: number[],
  opts: { highlight?: number; colors?: string[]; valueName?: string; labels?: string[] } = {},
): EChartsCoreOption {
  return {
    grid: baseGrid,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', name: opts.valueName },
    yAxis: { type: 'category', data: categories, inverse: true, axisLabel: { width: 140, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: opts.colors?.[i] ?? (i === opts.highlight ? p.accent : p.cat[2]) },
        })),
        label: opts.labels
          ? { show: true, position: 'right', color: p.muted, formatter: (x: { dataIndex: number }) => opts.labels![x.dataIndex] }
          : undefined,
        barMaxWidth: 18,
      },
    ],
  };
}

/** Vertical bars for a 1–10 histogram, optionally with a second (comparison) series. */
export function ratingHistogram(
  p: ChartPalette,
  series: { name: string; values: number[]; color?: string }[],
): EChartsCoreOption {
  return {
    grid: baseGrid,
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { top: 0 } : undefined,
    xAxis: { type: 'category', data: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
    yAxis: { type: 'value' },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      data: s.values,
      itemStyle: { color: s.color ?? (i === 0 ? p.accent : p.cat[2]) },
      barMaxWidth: 24,
    })),
  };
}

export function lineOverTime(
  p: ChartPalette,
  labels: string[],
  values: number[],
  opts: { area?: boolean; zoom?: boolean } = {},
): EChartsCoreOption {
  return {
    grid: { ...baseGrid, bottom: opts.zoom ? 40 : 8 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels, boundaryGap: false },
    yAxis: { type: 'value' },
    dataZoom: opts.zoom ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }] : undefined,
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: p.accent, width: 2 },
        areaStyle: opts.area ? { color: p.accent, opacity: 0.15 } : undefined,
      },
    ],
  };
}
