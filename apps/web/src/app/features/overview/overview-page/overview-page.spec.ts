import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { OverviewPage } from './overview-page';

describe('OverviewPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])], deferBlockBehavior: DeferBlockBehavior.Manual });
  });

  async function render() {
    const f = TestBed.createComponent(OverviewPage);
    await f.whenStable();
    return f;
  }

  const tile = (f: Awaited<ReturnType<typeof render>>, label: string) =>
    pageText(f).match(new RegExp(`${label} (\\S+)`))?.[1];

  it('shows KPIs computed from the library', async () => {
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([
        exportItem(1, { rating: 8, ratedAt: '2024-01-05T20:00:00.000Z' }),
        exportItem(2, { rating: 6, ratedAt: '2024-02-05T20:00:00.000Z' }),
        exportItem(3, { kind: 'serial', rating: 7 }),
        exportItem(4, { list: 'want2see', rating: undefined }),
      ]),
      'import',
      [enrichment(1, { runtimeMinutes: 90 }), enrichment(2, { runtimeMinutes: 120 })],
    );
    const f = await render();
    expect(tile(f, 'Ocenione: filmy')).toBe('2');
    expect(tile(f, 'Ocenione: seriale')).toBe('1');
    expect(tile(f, 'Chcę zobaczyć')).toBe('1');
    expect(tile(f, 'Średnia ocena')).toBe('7,0');
    expect(pageText(f)).toContain('Suma czasu 2 filmów');
    expect(pageText(f)).toContain('Oceny w czasie');
    expect(pageText(f)).toContain('Rozkład ocen');
  });

  it('explains that the data has no rating dates (e.g. a data-request copy)', async () => {
    await TestBed.inject(LibraryStore).loadExport(exportFile([exportItem(1, { rating: 8 })], { source: 'csv' }), 'import');
    const f = await render();
    expect(pageText(f)).toContain('Wczytane pliki nie zawierają dat ocen');
    expect(tile(f, 'Średnia ocena')).toBe('8,0');
  });

  it('shows empty charts without ratings', async () => {
    const f = await render();
    expect(tile(f, 'Średnia ocena')).toBe('–');
    expect(pageText(f).match(/Brak danych dla wybranych filtrów\./g)).toHaveLength(2);
  });
});
