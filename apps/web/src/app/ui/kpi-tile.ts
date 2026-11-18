import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** KPI tile with subtle film-strip perforation on both sides (SPEC §9.5). */
@Component({
  selector: 'ks-kpi-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    .tile { position: relative; padding: 14px 26px; background: var(--ks-surface); border: 1px solid var(--ks-border);
      border-radius: var(--ks-radius); height: 100%; }
    .tile::before, .tile::after { content: ''; position: absolute; top: 10px; bottom: 10px; width: 6px;
      background-image: radial-gradient(circle, var(--ks-bg) 2.2px, transparent 2.6px); background-size: 6px 12px; opacity: 0.9; }
    .tile::before { left: 8px; }
    .tile::after { right: 8px; }
  `,
  template: `
    <div class="tile">
      <p class="text-xs uppercase tracking-wider text-ks-muted">{{ label() }}</p>
      <p class="font-display text-4xl leading-tight tabular text-ks-text">{{ value() }}</p>
      @if (hint()) { <p class="text-xs text-ks-muted">{{ hint() }}</p> }
    </div>
  `,
})
export class KpiTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>();
}
