import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, pageText } from '../../testing/dom';
import { ChartCard } from './chart-card';

describe('ChartCard', () => {
  beforeEach(() => {
    // ECharts is never started: the deferred chart block stays on its placeholder.
    TestBed.configureTestingModule({ deferBlockBehavior: DeferBlockBehavior.Manual });
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(inputs: Record<string, unknown> = {}) {
    const f = TestBed.createComponent(ChartCard);
    f.componentRef.setInput('heading', 'Rozkład ocen');
    f.componentRef.setInput('option', {});
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    await f.whenStable();
    return f;
  }

  const table = { columns: ['Ocena', 'Liczba'], rows: [[1, 3], [2, undefined]] };

  it('shows the heading and keeps the chart deferred until it enters the viewport', async () => {
    const f = await render({ subtitle: 'Wszystkie oceny' });
    expect(pageText(f)).toBe('Rozkład ocen Wszystkie oceny');
    const [block] = await f.getDeferBlocks();
    expect(block).toBeDefined();
    expect(f.nativeElement.querySelector('[echarts]')).toBeNull();
  });

  it('shows the empty text instead of the chart', async () => {
    const f = await render({ empty: true, emptyText: 'Brak ocen.' });
    expect(pageText(f)).toContain('Brak ocen.');
    expect(await f.getDeferBlocks()).toHaveLength(0);
  });

  it('has no table toggle without table data', async () => {
    const f = await render();
    expect(f.nativeElement.querySelector('button')).toBeNull();
  });

  it('switches to an accessible table labelled by the heading, and back', async () => {
    const f = await render({ table });
    await click(f, 'Pokaż jako tabelę');
    const t = f.nativeElement.querySelector('table') as HTMLTableElement;
    expect(t.getAttribute('aria-labelledby')).toBe(f.nativeElement.querySelector('h2').id);
    expect(Array.from(t.querySelectorAll('th')).map((th) => th.textContent)).toEqual(['Ocena', 'Liczba']);
    expect(Array.from(t.querySelectorAll('tbody tr')).map((tr) => tr.textContent)).toEqual(['13', '2–']);
    expect(f.nativeElement.querySelector('button[aria-pressed]').getAttribute('aria-pressed')).toBe('true');

    await click(f, 'Pokaż wykres');
    expect(f.nativeElement.querySelector('table')).toBeNull();
  });

  it('downloads the table as CSV named after the heading', async () => {
    // jsdom has no object URLs.
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const f = await render({ table, heading: 'Oceny w czasie' });
    await click(f, 'Pokaż jako tabelę');
    await click(f, 'CSV');
    expect(createObjectURL).toHaveBeenCalledOnce();
    const anchor = anchorClick.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('kinoskop-oceny-w-czasie.csv');
  });
});
