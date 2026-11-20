import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** User rating shown as a cinema ticket with notches (SPEC §9.2, §9.5) – never as stars. */
@Component({
  selector: 'ks-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  templateUrl: './ticket.html',
  styleUrl: './ticket.scss',
})
export class Ticket {
  readonly rating = input<number>();
  label() {
    return this.rating() === undefined ? 'bez oceny' : `ocena ${this.rating()} na 10`;
  }
}
