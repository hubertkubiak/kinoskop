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
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly data = inject<ConfirmData>(DIALOG_DATA);
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
