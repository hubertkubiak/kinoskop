import { Dialog } from '@angular/cdk/dialog';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog, type ConfirmData } from '../ui/confirm-dialog';
import { LibraryStore } from './library.store';

/** Hooks run on "Usuń moje dane" (e.g. the AI key store registers itself here). */
@Injectable({ providedIn: 'root' })
export class DataResetService {
  private readonly dialog = inject(Dialog);
  private readonly store = inject(LibraryStore);
  private readonly router = inject(Router);
  private readonly hooks: (() => void)[] = [];

  onReset(hook: () => void): void {
    this.hooks.push(hook);
  }

  async confirmAndReset(): Promise<void> {
    const ref = this.dialog.open<boolean, ConfirmData>(ConfirmDialog, {
      data: {
        title: 'Usunąć Twoje dane?',
        body: 'Usuniemy z tej przeglądarki zaimportowane oceny, dopasowania, wyniki AI i klucz AI. Tej operacji nie można cofnąć.',
        confirm: 'Usuń moje dane',
      },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    await this.store.clear();
    for (const h of this.hooks) h();
    await this.router.navigateByUrl('/start');
  }
}
