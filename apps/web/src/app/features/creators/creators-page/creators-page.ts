import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { peopleRanking, type PersonRow } from '@kinoskop/stats';
import { FiltersStore } from '../../../core/filters.store';
import { countryName, fmtAvg } from '../../../core/format';
import { CreatorPanel } from '../creator-panel/creator-panel';

@Component({
  selector: 'ks-creators-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './creators-page.html',
})
export class CreatorsPage {
  private readonly fs = inject(FiltersStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  readonly role = signal<'director' | 'cast'>('director');
  readonly min = signal(3);
  readonly sort = signal<'count' | 'avg'>('count');
  readonly avg = fmtAvg;

  readonly rows = computed(() => {
    const rows = peopleRanking(this.fs.filtered(), this.role(), this.min());
    const sorted = this.sort() === 'avg' ? [...rows].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || b.count - a.count) : rows;
    return sorted.slice(0, 200);
  });

  nat(r: PersonRow): string {
    return r.person.nationalities.map(countryName).join(', ') || '–';
  }

  open(row: PersonRow): void {
    this.dialog.open(CreatorPanel, {
      data: row,
      positionStrategy: this.overlay.position().global().right('0').top('0'),
      height: '100vh',
      ariaLabelledBy: 'ks-creator-name',
    });
  }
}
