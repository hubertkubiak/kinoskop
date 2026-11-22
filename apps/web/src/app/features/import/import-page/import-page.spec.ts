import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, pageText } from '../../../testing/dom';
import { exportFile, exportItem, textFile } from '../../../testing/fixtures';
import { IMPORT_STRINGS } from '../import.strings';
import { ImportService } from '../import.service';
import { ImportPage } from './import-page';

const SCRIPT = '(()=>{/* kinoskop */})()';

describe('ImportPage', () => {
  const copy = vi.fn(() => true);
  const importer = {
    busy: signal(false),
    error: signal<string | null>(null),
    pending: signal<unknown>(null),
    api: { awake: signal(true), config: signal({ tmdbEnabled: true, gamesEnabled: false, criticsEnabled: false }) },
    importFiles: vi.fn(async () => true),
    loadDemo: vi.fn(async () => undefined),
    confirmPending: vi.fn(async () => undefined),
    cancelPending: vi.fn(),
  };

  beforeEach(() => {
    copy.mockClear();
    importer.importFiles.mockClear();
    importer.error.set(null);
    importer.pending.set(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('.js') ? new Response(SCRIPT) : new Response('javascript:void(0)'),
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ImportService, useValue: importer },
        { provide: Clipboard, useValue: { copy } },
      ],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    const f = TestBed.createComponent(ImportPage);
    await vi.waitFor(() => expect(f.componentInstance.script()).toBe(SCRIPT));
    await f.whenStable();
    return f;
  }

  const copyButton = (f: Awaited<ReturnType<typeof render>>) =>
    Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) =>
      b.textContent?.includes(IMPORT_STRINGS.copy),
    ) as HTMLButtonElement;

  it('copies the script only after the terms are accepted', async () => {
    const f = await render();
    expect(copyButton(f).disabled).toBe(true);

    (f.nativeElement.querySelector('[data-testid="legal"]') as HTMLInputElement).click();
    await f.whenStable();
    expect(copyButton(f).disabled).toBe(false);

    copyButton(f).click();
    await f.whenStable();
    expect(copy).toHaveBeenCalledWith(SCRIPT);
    expect(pageText(f)).toContain(IMPORT_STRINGS.copied);
  });

  it('shows the script source on request', async () => {
    const f = await render();
    expect(pageText(f)).not.toContain(SCRIPT);
    await click(f, IMPORT_STRINGS.showCode);
    expect(pageText(f)).toContain(SCRIPT);
  });

  it('starts the demo', async () => {
    const f = await render();
    (f.nativeElement.querySelector('[data-testid="demo"]') as HTMLButtonElement).click();
    expect(importer.loadDemo).toHaveBeenCalledOnce();
  });

  it('passes picked and dropped files to the import and resets the picker', async () => {
    const f = await render();
    const file = textFile('kinoskop-eksport.json', JSON.stringify(exportFile([exportItem(1)])));

    const input = f.nativeElement.querySelector('[data-testid="file-input"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(importer.importFiles).toHaveBeenLastCalledWith([file]);

    f.componentInstance.onDrop({ preventDefault: vi.fn(), dataTransfer: { files: [file] } } as unknown as DragEvent);
    expect(importer.importFiles).toHaveBeenCalledTimes(2);
    expect(f.componentInstance.dragOver()).toBe(false);
  });

  it('shows import errors', async () => {
    const f = await render();
    importer.error.set('Plik nie jest poprawnym JSON-em.');
    await f.whenStable();
    expect(pageText(f)).toContain('Plik nie jest poprawnym JSON-em.');
  });

  it('works without the downloadable script (copy stays disabled)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const f = TestBed.createComponent(ImportPage);
    await f.whenStable();
    (f.nativeElement.querySelector('[data-testid="legal"]') as HTMLInputElement).click();
    await f.whenStable();
    expect(copyButton(f).disabled).toBe(true);
  });
});
