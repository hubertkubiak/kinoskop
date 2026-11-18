import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FiltersStore } from '../../core/filters.store';

@Component({
  selector: 'ks-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-display text-4xl uppercase mb-4">Przegląd</h1>
    <p class="text-ks-muted">Zaimportowano {{ fs.total() }} pozycji.</p>
  `,
})
export class OverviewPage {
  readonly fs = inject(FiltersStore);
}
