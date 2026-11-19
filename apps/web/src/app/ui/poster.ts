import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** Poster from TMDB/IGDB (never hotlinked from the rating site) with a text fallback. */
@Component({
  selector: 'ks-poster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0 overflow-hidden rounded-ks-sm bg-ks-surface-2 border border-ks-border' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="'Plakat: ' + title()" loading="lazy" referrerpolicy="no-referrer"
        class="w-full h-full object-cover" (error)="failed.set(true)" />
    } @else {
      <div class="w-full h-full grid place-items-center p-1 text-[10px] leading-tight text-ks-muted text-center" aria-hidden="true">
        {{ title() }}
      </div>
    }
  `,
})
export class Poster {
  readonly src = input<string>();
  readonly title = input('');
  readonly failed = signal(false);
}
