import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** "Film leader" countdown loader (SPEC §9.5) with the real progress next to it. */
@Component({
  selector: 'ks-film-leader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-3', role: 'status', 'aria-live': 'polite' },
  styles: `
    .leader { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--ks-accent); position: relative;
      display: grid; place-items: center; font-family: var(--ks-font-display); font-size: 20px; color: var(--ks-accent); }
    .leader::before { content: ''; position: absolute; inset: 3px; border-radius: 50%;
      background: conic-gradient(var(--ks-surface-2) var(--p), transparent 0); }
    .leader span { position: relative; }
  `,
  template: `
    <div class="leader" [style.--p]="sweep()" aria-hidden="true"><span>{{ digit() }}</span></div>
    <p class="text-sm">{{ label() }} @if (total()) { <span class="tabular text-ks-muted">{{ done() }}/{{ total() }}</span> }</p>
  `,
})
export class FilmLeader {
  readonly label = input('Ładuję…');
  readonly done = input(0);
  readonly total = input(0);

  readonly fraction = computed(() => (this.total() ? this.done() / this.total() : 0));
  readonly digit = computed(() => Math.max(1, 3 - Math.floor(this.fraction() * 3)));
  readonly sweep = computed(() => `${Math.round(this.fraction() * 360)}deg`);
}
