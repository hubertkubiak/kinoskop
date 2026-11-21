import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../core/api.client';
import { EnrichmentService } from '../../core/enrichment.service';
import { LibraryStore } from '../../core/library.store';
import { enrichment, exportFile, exportItem, textFile } from '../../testing/fixtures';
import { ImportService } from './import.service';

describe('ImportService', () => {
  let service: ImportService;
  let store: LibraryStore;
  let enrichStart: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    enrichStart = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EnrichmentService, useValue: { start: enrichStart } },
        { provide: ApiClient, useValue: { warmUp: vi.fn(async () => undefined) } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    store = TestBed.inject(LibraryStore);
    service = TestBed.inject(ImportService);
  });

  const json = (f = exportFile([exportItem(1)])) => textFile('kinoskop-eksport-2026-11-01.json', JSON.stringify(f));

  it('imports a script export, starts enrichment and opens the overview', async () => {
    expect(await service.importFiles([json()])).toBe(true);
    expect(store.items().map((i) => i.key)).toEqual(['film:1']);
    expect(enrichStart).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/przeglad');
    expect(service.busy()).toBe(false);
  });

  it('merges a later file of the same user instead of replacing the data', async () => {
    await service.importFiles([json(exportFile([exportItem(1)], { part: 'base' }))]);
    await store.addEnrichments([enrichment(1)]);
    await service.importFiles([json(exportFile([exportItem(1), exportItem(2)], { part: 'full' }))]);
    expect(store.items()).toHaveLength(2);
    expect(store.enrichments().has('film:1')).toBe(true);
  });

  it('rejects invalid JSON, a wrong schema version and too large files', async () => {
    expect(await service.importFiles([textFile('a.json', '{oops')])).toBe(false);
    expect(service.error()).toContain('JSON');
    expect(await service.importFiles([textFile('a.json', '{"schemaVersion":99}')])).toBe(false);
    expect(service.error()).toContain('wersja schematu');
    const big = { name: 'a.json', size: 21 * 1024 * 1024, text: async () => '' } as unknown as File;
    expect(await service.importFiles([big])).toBe(false);
    expect(service.error()).toContain('20 MB');
    expect(store.hasData()).toBe(false);
  });

  it('does not mix a JSON export with other files', async () => {
    expect(await service.importFiles([json(), textFile('b.csv', 'Title,Year\nX,2001\n')])).toBe(false);
    expect(service.error()).toContain('jeden plik');
  });

  it('rejects an unknown CSV format', async () => {
    expect(await service.importFiles([textFile('x.csv', 'foo,bar\n1,2\n')])).toBe(false);
    expect(service.error()).toContain('Nie rozpoznaję formatu pliku „x.csv”');
  });

  it('shows a CSV summary first and stores the data only after confirmation', async () => {
    expect(await service.importFiles([textFile('ratings.csv', 'Title,Year,Rating10\nPierwszy,2001,8\nDrugi,1999,6\n')])).toBe(true);
    expect(service.pending()?.file.items).toHaveLength(2);
    expect(store.hasData()).toBe(false);
    expect(enrichStart).not.toHaveBeenCalled();

    await service.confirmPending();
    expect(service.pending()).toBeNull();
    expect(store.items()).toHaveLength(2);
    expect(enrichStart).toHaveBeenCalledOnce();
  });

  it('cancelPending drops the CSV summary', async () => {
    await service.importFiles([textFile('ratings.csv', 'Title,Year\nPierwszy,2001\n')]);
    service.cancelPending();
    expect(service.pending()).toBeNull();
    await service.confirmPending();
    expect(store.hasData()).toBe(false);
  });

  it('points to the CSV tables when only a raw archive of the export tool is given', async () => {
    const archive = textFile('archiwum.json', '{"script":"Filmweb2Letterboxd","items":[]}');
    expect(await service.importFiles([archive])).toBe(false);
    expect(service.error()).toContain('surowe archiwum');
  });
});
