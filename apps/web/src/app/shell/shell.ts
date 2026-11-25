import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BRAND } from '@kinoskop/shared';
import { DataResetService } from '../core/data-reset.service';
import { LibraryStore } from '../core/library.store';
import { Icon } from '../ui/icon/icon';
import { NAV_ITEMS } from './nav';
import { StatusBanners } from './status-banners/status-banners';
import { SiteFooter } from './site-footer/site-footer';
import { FilterBar } from '../filters/filter-bar/filter-bar';
import { ThemeToggle } from './theme-toggle/theme-toggle';

@Component({
  selector: 'ks-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, StatusBanners, SiteFooter, FilterBar, ThemeToggle],
  templateUrl: './shell.html',
})
export class Shell {
  readonly store = inject(LibraryStore);
  private readonly reset = inject(DataResetService);
  readonly brand = BRAND;
  readonly nav = NAV_ITEMS;
  readonly primaryNav = NAV_ITEMS.filter((n) => n.primary);
  readonly moreNav = NAV_ITEMS.filter((n) => !n.primary);
  readonly moreOpen = signal(false);

  readonly toVerify = computed(
    () =>
      this.store.library().filter((i) => i.enrichment === undefined || i.enrichment.match.confidence < 0.8)
        .length,
  );

  deleteData(): void {
    void this.reset.confirmAndReset();
  }
}
