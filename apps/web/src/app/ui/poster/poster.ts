import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** Poster from TMDB/IGDB (never hotlinked from the rating site) with a text fallback. */
@Component({
  selector: 'ks-poster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0 overflow-hidden rounded-ks-sm bg-ks-surface-2 border border-ks-border' },
  templateUrl: './poster.html',
  styleUrl: './poster.scss',
})
export class Poster {
  readonly src = input<string>();
  readonly title = input('');
  readonly failed = signal(false);
}
