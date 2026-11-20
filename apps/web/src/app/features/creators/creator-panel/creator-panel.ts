import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { PersonRow } from '@kinoskop/stats';
import { countryName, fmtAvg } from '../../../core/format';
import { Icon } from '../../../ui/icon/icon';
import { Poster } from '../../../ui/poster/poster';
import { Ticket } from '../../../ui/ticket/ticket';

/** Creator card (SPEC §7.6) shown as a side panel. */
@Component({
  selector: 'ks-creator-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Poster, Ticket],
  host: { class: 'block ks-card p-5 h-full overflow-y-auto w-[min(420px,100vw)]' },
  templateUrl: './creator-panel.html',
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
