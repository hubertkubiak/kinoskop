import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** KPI tile with subtle film-strip perforation on both sides (SPEC §9.5). */
@Component({
  selector: 'ks-kpi-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './kpi-tile.html',
  styleUrl: './kpi-tile.scss',
})
export class KpiTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>();
}
