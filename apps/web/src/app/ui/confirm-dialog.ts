import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export interface ConfirmData {
  title: string;
  body: string;
  confirm: string;
}

/** Accessible confirmation dialog (CDK Dialog traps focus and restores it on close). */
@Component({
  selector: 'ks-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block ks-card p-6 max-w-md', role: 'alertdialog', 'aria-labelledby': 'ks-confirm-title' },
  template: `
    <h2 id="ks-confirm-title" class="font-display text-2xl mb-2">{{ data.title }}</h2>
    <p class="text-ks-muted mb-6">{{ data.body }}</p>
    <div class="flex justify-end gap-3">
      <button type="button" class="ks-btn" (click)="ref.close(false)">Anuluj</button>
      <button type="button" class="ks-btn ks-btn-primary" (click)="ref.close(true)">{{ data.confirm }}</button>
    </div>
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmData>(DIALOG_DATA);
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
