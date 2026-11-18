import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { GraphNode } from '@kinoskop/stats';
import { type NgDiagramNodeTemplate, NgDiagramPortComponent, type Node } from 'ng-diagram';
import { ChartTheme } from '../../charts/theme';
import { fmtAvg } from '../../core/format';

/** Node rendered as an Angular component: genre (name, count, avg), person (photo, count), title (poster, rating). */
@Component({
  selector: 'ks-taste-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgDiagramPortComponent],
  styles: `
    .n { display: flex; align-items: center; gap: 8px; border-radius: 999px; border: 2px solid var(--c);
      background: var(--ks-surface); color: var(--ks-text); padding: 6px 12px 6px 6px; white-space: nowrap; font-size: 13px; }
    .n.you { padding: 14px 22px; font-family: var(--ks-font-display); font-size: 24px; background: var(--ks-accent); color: var(--ks-accent-ink); border-color: var(--ks-accent-strong); }
    .n.genre { font-weight: 600; }
    .n.title { border-radius: 6px; }
    .dot { width: var(--s); height: var(--s); border-radius: 50%; background: var(--c); flex-shrink: 0; overflow: hidden; }
    .dot img { width: 100%; height: 100%; object-fit: cover; }
    .meta { color: var(--ks-text-muted); font-variant-numeric: tabular-nums; font-size: 11px; }
  `,
  template: `
    @let d = node().data;
    <div class="n" [class]="d.kind" [style.--c]="color()" [style.--s.px]="dot()" [attr.title]="tooltip()">
      @if (d.kind !== 'you') {
        <span class="dot">@if (d.imageUrl) { <img [src]="d.imageUrl" alt="" loading="lazy" referrerpolicy="no-referrer" /> }</span>
      }
      <span>{{ d.label }}</span>
      @if (d.kind !== 'you') {
        <span class="meta">{{ d.kind === 'title' ? (d.rating ?? '–') : d.count + ' · ' + avg(d.avg) }}</span>
      }
      @if (d.expandable) { <span class="meta" aria-hidden="true">⊕</span> }
    </div>
    <ng-diagram-port id="in" side="left" type="target" />
    <ng-diagram-port id="out" side="right" type="source" />
  `,
})
export class TasteNode implements NgDiagramNodeTemplate<GraphNode & Record<string, unknown>> {
  readonly node = input.required<Node<GraphNode & Record<string, unknown>>>();
  private readonly theme = inject(ChartTheme);
  readonly avg = fmtAvg;

  readonly color = computed(() => this.theme.ratingColor(this.node().data.avg));
  readonly dot = computed(() => {
    const d = this.node().data;
    return d.kind === 'title' ? 34 : Math.round(16 + d.weight * 26);
  });
  readonly tooltip = computed(() => {
    const d = this.node().data;
    return d.kind === 'title' ? `${d.label}: ${d.rating ?? 'bez oceny'}` : `${d.label}: ${d.count} tytułów, średnia ${fmtAvg(d.avg)}`;
  });
}
