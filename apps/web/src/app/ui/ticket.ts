import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** User rating shown as a cinema ticket with notches (SPEC §9.2, §9.5) – never as stars. */
@Component({
  selector: 'ks-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  styles: `
    .t { --n: 5px; display: inline-grid; place-items: center; min-width: 34px; height: 24px; padding: 0 8px;
      background: var(--ks-accent); color: var(--ks-accent-ink); font-family: var(--ks-font-display); font-size: 16px;
      border-radius: 4px;
      -webkit-mask: radial-gradient(circle var(--n) at 0 50%, transparent 98%, #000) left / 51% 100% no-repeat,
                    radial-gradient(circle var(--n) at 100% 50%, transparent 98%, #000) right / 51% 100% no-repeat;
              mask: radial-gradient(circle var(--n) at 0 50%, transparent 98%, #000) left / 51% 100% no-repeat,
                    radial-gradient(circle var(--n) at 100% 50%, transparent 98%, #000) right / 51% 100% no-repeat; }
    .muted { background: var(--ks-surface-2); color: var(--ks-text-muted); }
  `,
  template: `<span class="t tabular" [class.muted]="rating() === undefined" [attr.aria-label]="label()">{{ rating() ?? '–' }}</span>`,
})
export class Ticket {
  readonly rating = input<number>();
  label() {
    return this.rating() === undefined ? 'bez oceny' : `ocena ${this.rating()} na 10`;
  }
}
