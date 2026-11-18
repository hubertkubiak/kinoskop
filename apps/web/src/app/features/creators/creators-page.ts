import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { peopleRanking, type PersonRow } from '@kinoskop/stats';
import { FiltersStore } from '../../core/filters.store';
import { countryName, fmtAvg } from '../../core/format';
import { CreatorPanel } from './creator-panel';

@Component({
  selector: 'ks-creators-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-display text-4xl uppercase mb-4">Twórcy</h1>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div role="tablist" aria-label="Rola" class="flex gap-2">
        <button type="button" role="tab" class="ks-chip pr-3" [attr.aria-selected]="role() === 'director'"
          [class.!border-ks-accent]="role() === 'director'" (click)="role.set('director')">Reżyserzy</button>
        <button type="button" role="tab" class="ks-chip pr-3" [attr.aria-selected]="role() === 'cast'"
          [class.!border-ks-accent]="role() === 'cast'" (click)="role.set('cast')">Aktorzy</button>
      </div>
      <label class="text-sm flex items-center gap-2">Min. tytułów
        <input type="number" min="1" max="50" class="ks-input w-20 tabular" [value]="min()" (change)="min.set(+$any($event.target).value || 1)" />
      </label>
      <label class="text-sm flex items-center gap-2">Sortuj
        <select class="ks-input" [value]="sort()" (change)="sort.set($any($event.target).value)">
          <option value="count">liczba tytułów</option>
          <option value="avg">średnia ocena</option>
        </select>
      </label>
    </div>

    <div class="ks-card overflow-x-auto">
      <table class="ks-table">
        <caption class="sr-only">Ranking twórców</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Twórca</th><th scope="col">Narodowość</th><th scope="col">Tytuły</th><th scope="col">Średnia</th></tr></thead>
        <tbody>
          @for (r of rows(); track r.key; let i = $index) {
            <tr>
              <td class="tabular text-ks-muted">{{ i + 1 }}</td>
              <td><button type="button" class="underline-offset-2 hover:underline text-left" (click)="open(r)">{{ r.person.name }}</button></td>
              <td class="text-ks-muted">{{ nat(r) }}</td>
              <td class="tabular">{{ r.count }}</td>
              <td class="tabular">{{ avg(r.avg) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="text-ks-muted">Brak twórców spełniających kryteria.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
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
