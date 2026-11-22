import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { click, pageText } from '../../testing/dom';
import { ConfirmDialog, type ConfirmData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  function render() {
    const close = vi.fn();
    const data: ConfirmData = { title: 'Usunąć Twoje dane?', body: 'Tej operacji nie można cofnąć.', confirm: 'Usuń moje dane' };
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close } },
      ],
    });
    return { f: TestBed.createComponent(ConfirmDialog), close };
  }

  it('is an alert dialog labelled by its title', async () => {
    const { f } = render();
    await f.whenStable();
    const host = f.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('alertdialog');
    expect(host.querySelector(`#${host.getAttribute('aria-labelledby')}`)?.textContent).toBe('Usunąć Twoje dane?');
    expect(pageText(f)).toContain('Tej operacji nie można cofnąć.');
  });

  it('closes with true on confirm and false on cancel', async () => {
    const { f, close } = render();
    await f.whenStable();
    await click(f, 'Usuń moje dane');
    expect(close).toHaveBeenLastCalledWith(true);
    await click(f, 'Anuluj');
    expect(close).toHaveBeenLastCalledWith(false);
  });
});
