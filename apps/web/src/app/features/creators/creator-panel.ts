import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { PersonRow } from '@kinoskop/stats';
import { countryName, fmtAvg } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Poster } from '../../ui/poster';
import { Ticket } from '../../ui/ticket';

/** Creator card (SPEC §7.6) shown as a side panel. */
@Component({
  selector: 'ks-creator-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Poster, Ticket],
  host: { class: 'block ks-card p-5 h-full overflow-y-auto w-[min(420px,100vw)]' },
  template: `
    <div class="flex justify-between items-start gap-3 mb-4">
      <div class="flex gap-3 items-center">
        <ks-poster class="w-16 h-20" [src]="row.person.profileUrl" [title]="row.person.name" />
        <div>
          <h2 id="ks-creator-name" class="font-display text-2xl uppercase">{{ row.person.name }}</h2>
          <p class="text-sm text-ks-muted">{{ nationality() }}</p>
          <p class="text-sm tabular">{{ row.count }} tytułów · śr. {{ avg(row.avg) }}</p>
        </div>
      </div>
      <button type="button" class="ks-btn !p-1.5" aria-label="Zamknij" (click)="ref.close()"><ks-icon name="close" /></button>
    </div>
    <button type="button" class="ks-btn text-sm mb-4" (click)="network()"><ks-icon name="graph" [size]="16" /> Pokaż współpracowników</button>
    <h3 class="font-semibold mb-2">Obejrzane tytuły</h3>
    <ul class="space-y-1.5">
      @for (t of titles(); track t.key) {
        <li class="flex items-center gap-2 text-sm">
          <ks-ticket [rating]="t.rating" />
          <span class="flex-1">{{ t.title }}</span>
          <span class="text-ks-muted tabular">{{ t.year }}</span>
        </li>
      }
    </ul>
    <p class="text-xs text-ks-muted mt-4">Zdjęcie: TMDB. Narodowość: Wikidata.</p>
  `,
})
export class CreatorPanel {
  readonly row = inject<PersonRow>(DIALOG_DATA);
  readonly ref = inject(DialogRef);
  private readonly router = inject(Router);
  readonly avg = fmtAvg;

  readonly nationality = computed(() => this.row.person.nationalities.map(countryName).join(', ') || 'narodowość nieznana');
  readonly titles = computed(() => [...this.row.titles].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));

  network(): void {
    this.ref.close();
    void this.router.navigate(['/gust'], { queryParams: { siec: this.row.key }, queryParamsHandling: 'merge' });
  }
}
