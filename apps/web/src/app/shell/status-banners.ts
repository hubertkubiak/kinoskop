import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnrichmentService } from '../core/enrichment.service';
import { LibraryStore } from '../core/library.store';
import { FilmLeader } from '../ui/film-leader';

@Component({
  selector: 'ks-status-banners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FilmLeader],
  template: `
    @if (store.isDemo()) {
      <p class="px-4 py-2 text-sm bg-ks-surface-2 border-t border-ks-border">
        Oglądasz przykładowe dane.
        <a routerLink="/start" class="text-ks-accent underline underline-offset-2">Zaimportuj swoje</a>
      </p>
    }
    @if (!store.persistent()) {
      <p class="px-4 py-2 text-sm bg-ks-surface-2 border-t border-ks-border" role="status">
        Przeglądarka nie pozwala zapisać danych lokalnie. Dane znikną po odświeżeniu strony.
      </p>
    }
    @if (enrich.active()) {
      <div class="px-4 py-2 bg-ks-surface-2 border-t border-ks-border">
        <ks-film-leader [label]="enrich.label()" [done]="enrich.done()" [total]="enrich.total()" />
      </div>
    } @else if (enrich.phase() === 'error') {
      <p class="px-4 py-2 text-sm bg-ks-surface-2 border-t border-ks-border" role="alert">
        {{ enrich.label() }}
        <button type="button" class="underline text-ks-accent" (click)="enrich.start()">Spróbuj ponownie</button>
      </p>
    } @else if (enrich.phase() === 'done' && enrich.unmatched() > 0) {
      <p class="px-4 py-2 text-sm bg-ks-surface-2 border-t border-ks-border" role="status">
        Nie udało się automatycznie dopasować {{ enrich.unmatched() }} tytułów.
        <a routerLink="/weryfikacja" queryParamsHandling="preserve" class="underline text-ks-accent">Sprawdź je</a>
      </p>
    }
  `,
})
export class StatusBanners {
  readonly store = inject(LibraryStore);
  readonly enrich = inject(EnrichmentService);
}
