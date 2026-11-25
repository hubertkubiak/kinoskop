import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { click, pageText, textOf } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { GenresPage } from './genres-page';

describe('GenresPage', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])], deferBlockBehavior: DeferBlockBehavior.Manual });
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([
        exportItem(1, { rating: 9 }),
        exportItem(2, { rating: 7 }),
        exportItem(3, { rating: 5 }),
        exportItem(4, { list: 'want2see', rating: undefined }),
      ]),
      'import',
      [
        enrichment(1, { genres: ['Dramat', 'Wojenny'] }),
        enrichment(2, { genres: ['Dramat'] }),
        enrichment(3, { genres: ['Komedia'] }),
        enrichment(4, { genres: ['Komedia'] }),
      ],
    );
  });

  async function render() {
    const f = TestBed.createComponent(GenresPage);
    await f.whenStable();
    return f;
  }

  it('counts genres of rated films and names the top one', async () => {
    const f = await render();
    expect(pageText(f)).toContain('Top: Dramat');
    await click(f, 'Pokaż jako tabelę');
    const rows = Array.from(f.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>).map(textOf);
    // The want-to-see title does not count.
    expect(rows).toEqual(['Dramat 2 8', 'Komedia 1 5', 'Wojenny 1 9']);
  });

  it('switches the type tab and shows empty charts for a type without titles', async () => {
    const f = await render();
    await click(f, 'Seriale');
    expect(f.nativeElement.querySelector('[role=tab][aria-selected=true]')?.textContent).toContain('Seriale');
    expect(pageText(f)).not.toContain('Top:');
    expect(pageText(f).match(/Brak danych dla wybranych filtrów\./g)).toHaveLength(4);
  });
});
