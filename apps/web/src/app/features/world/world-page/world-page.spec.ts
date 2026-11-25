import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { byText, click, pageText, textOf } from '../../../testing/dom';
import { enrichment, exportFile, exportItem, person } from '../../../testing/fixtures';
import { WorldPage } from './world-page';

// The real map needs ECharts and the GeoJSON asset; the page only registers it.
const registerMap = vi.fn();
vi.mock('../../../charts/echarts-setup', () => ({ echarts: { getMap: () => undefined, registerMap } }));

describe('WorldPage', () => {
  let resolveGeo: (v: unknown) => void;

  beforeEach(async () => {
    registerMap.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((r) => (resolveGeo = () => r({ json: async () => ({ type: 'FeatureCollection' }) })))),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([])], deferBlockBehavior: DeferBlockBehavior.Manual });
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([exportItem(1, { rating: 8 }), exportItem(2, { rating: 6 }), exportItem(3, { rating: 4 })]),
      'import',
      [
        enrichment(1, { countries: ['PL', 'DE'], directors: [person('Reżyser Polski', 1, ['PL'])] }),
        enrichment(2, { countries: ['PL'], directors: [person('Reżyser Bez Danych', 2)] }),
        enrichment(3, { countries: ['FR'] }),
      ],
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    const f = TestBed.createComponent(WorldPage);
    await f.whenStable();
    return f;
  }

  const tableOf = async (f: Awaited<ReturnType<typeof render>>, heading: string) => {
    const card = byText(f, 'ks-chart-card', heading);
    card?.querySelector('button')?.click();
    await f.whenStable();
    return Array.from(card?.querySelectorAll('tbody tr') ?? []).map(textOf);
  };

  it('shows a loading state until the map is registered', async () => {
    const f = await render();
    expect(pageText(f)).toContain('Ładuję mapę…');
    resolveGeo(undefined);
    await vi.waitFor(() => expect(registerMap).toHaveBeenCalledWith('world', { type: 'FeatureCollection' }));
    await f.whenStable();
    expect(pageText(f)).not.toContain('Ładuję mapę…');
  });

  it('ranks production countries with Polish names', async () => {
    const f = await render();
    expect(await tableOf(f, 'Ranking krajów')).toEqual(['Polska 2 7', 'Niemcy 1 8', 'Francja 1 4']);
  });

  it('counts director nationalities with unknown ones and switches to actors', async () => {
    const f = await render();
    expect(await tableOf(f, 'Narodowość twórców')).toEqual(['nieznana 2 5', 'Polska 1 8']);
    await click(f, 'Aktorzy (top 10 obsady)');
    expect(byText(f, '[role=tab][aria-selected=true]', 'Aktorzy')).toBeDefined();
  });
});
