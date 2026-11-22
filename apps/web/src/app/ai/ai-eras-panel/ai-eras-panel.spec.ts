import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore } from '../../core/library.store';
import { click, pageText } from '../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../testing/fixtures';
import { AiKeyStore } from '../ai-key.store';
import { EraClassifier } from '../era-classifier.service';
import { AiErasPanel } from './ai-eras-panel';

describe('AiErasPanel', () => {
  let store: LibraryStore;
  let key: AiKeyStore;
  let ai: EraClassifier;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(LibraryStore);
    key = TestBed.inject(AiKeyStore);
    ai = TestBed.inject(EraClassifier);
  });

  async function render() {
    const f = TestBed.createComponent(AiErasPanel);
    await f.whenStable();
    return f;
  }

  it('is hidden when every title has an era', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import', [
      enrichment(1, { setInPeriod: [{ key: 'antiquity', source: 'wikidata' }] }),
    ]);
    expect(pageText(await render())).toBe('');
  });

  describe('with titles without an era', () => {
    beforeEach(async () => {
      await store.loadExport(exportFile([exportItem(1), exportItem(2)]), 'import', [enrichment(1), enrichment(2)]);
    });

    it('opens the settings and keeps the run button disabled without a key', async () => {
      const f = await render();
      expect(f.nativeElement.querySelector('select')).toBeNull();
      await click(f, /./); // the first button toggles the settings
      expect(f.nativeElement.querySelector('select')).not.toBeNull();
      const run = f.nativeElement.querySelector('[data-testid="ai-run"]') as HTMLButtonElement;
      expect(run.disabled).toBe(true);
    });

    it('takes the key from a password field and enables the run', async () => {
      const f = await render();
      await click(f, /./);
      const input = f.nativeElement.querySelector('[data-testid="ai-key"]') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.autocomplete).toBe('off');
      input.value = 'sk-test-1234567890';
      input.dispatchEvent(new Event('change'));
      await f.whenStable();
      expect(key.apiKey()).toBe('sk-test-1234567890');
      expect(sessionStorage.length).toBe(0);
      expect((f.nativeElement.querySelector('[data-testid="ai-run"]') as HTMLButtonElement).disabled).toBe(false);

      const run = vi.spyOn(ai, 'run').mockResolvedValue();
      (f.nativeElement.querySelector('[data-testid="ai-run"]') as HTMLButtonElement).click();
      expect(run).toHaveBeenCalledOnce();
    });

    it('changing the provider clears the key', async () => {
      key.setKey('sk-test-1234567890');
      const f = await render();
      await click(f, /./);
      const select = f.nativeElement.querySelector('select') as HTMLSelectElement;
      select.value = 'openrouter';
      select.dispatchEvent(new Event('change'));
      await f.whenStable();
      expect(key.provider()).toBe('openrouter');
      expect(key.apiKey()).toBe('');
    });

    it('shows a stop button while running and the error afterwards', async () => {
      const f = await render();
      await click(f, /./);
      ai.state.set('running');
      await f.whenStable();
      const stop = vi.spyOn(ai, 'stop');
      await click(f, 'Przerwij');
      expect(stop).toHaveBeenCalledOnce();

      ai.state.set('error');
      ai.error.set('Nieprawidłowy klucz.');
      await f.whenStable();
      expect(pageText(f)).toContain('Nieprawidłowy klucz. Postęp jest zapisany');
    });
  });

  it('formats the cost estimate', () => {
    const panel = TestBed.createComponent(AiErasPanel).componentInstance;
    expect(panel.usd(undefined)).toBe('');
    expect(panel.usd(0.004)).toBe('< 0,01 USD');
    expect(panel.usd(1.234)).toBe('ok. 1,23 USD');
  });
});
