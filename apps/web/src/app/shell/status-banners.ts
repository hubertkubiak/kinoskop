import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryStore } from '../core/library.store';

@Component({
  selector: 'ks-status-banners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
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
  `,
})
export class StatusBanners {
  readonly store = inject(LibraryStore);
}
