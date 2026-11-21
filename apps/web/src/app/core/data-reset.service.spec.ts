import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportFile, exportItem } from '../testing/fixtures';
import { DataResetService } from './data-reset.service';
import { LibraryStore } from './library.store';

describe('DataResetService', () => {
  let answer: boolean | undefined;
  let service: DataResetService;
  let store: LibraryStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    answer = undefined;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Dialog, useValue: { open: () => ({ closed: of(answer) }) } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    store = TestBed.inject(LibraryStore);
    service = TestBed.inject(DataResetService);
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    sessionStorage.setItem('kinoskop-ai-v1', '{}');
  });

  it('keeps everything when the dialog is cancelled', async () => {
    const hook = vi.fn();
    service.onReset(hook);
    answer = false;
    await service.confirmAndReset();
    expect(store.hasData()).toBe(true);
    expect(hook).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('wipes data, runs hooks, removes the remembered AI key and goes to the start page', async () => {
    const hook = vi.fn();
    service.onReset(hook);
    answer = true;
    await service.confirmAndReset();
    expect(store.hasData()).toBe(false);
    expect(hook).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('kinoskop-ai-v1')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/start');
  });
});
