import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** "Film leader" countdown loader (SPEC §9.5) with the real progress next to it. */
@Component({
  selector: 'ks-film-leader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-3', role: 'status', 'aria-live': 'polite' },
  templateUrl: './film-leader.html',
  styleUrl: './film-leader.scss',
})
export class FilmLeader {
  readonly label = input('Ładuję…');
  readonly done = input(0);
  readonly total = input(0);

  readonly fraction = computed(() => (this.total() ? this.done() / this.total() : 0));
  readonly digit = computed(() => Math.max(1, 3 - Math.floor(this.fraction() * 3)));
  readonly sweep = computed(() => `${Math.round(this.fraction() * 360)}deg`);
}
