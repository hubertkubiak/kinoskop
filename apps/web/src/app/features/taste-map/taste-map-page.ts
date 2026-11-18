import { ChangeDetectionStrategy, Component, computed, inject, Injector, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { creatorNetwork, type Graph, tasteGraph } from '@kinoskop/stats';
import {
  type Middleware,
  NgDiagramBackgroundComponent,
  NgDiagramComponent,
  NgDiagramMinimapComponent,
  NgDiagramNodeTemplateMap,
  initializeModel,
  provideNgDiagram,
  type SelectionChangedEvent,
} from 'ng-diagram';
import { FiltersStore } from '../../core/filters.store';
import { TasteNode } from './taste-node';

/** Blocks every model modification: the map is read-only (SPEC §7.8). */
const READ_ONLY: Middleware<'read-only'> = {
  name: 'read-only',
  execute: (context, next, cancel) => {
    const blocked = ['addNodes', 'deleteNodes', 'updateNode', 'updateNodes', 'addEdges', 'deleteEdges', 'deleteElements', 'deleteSelection', 'paste', 'paletteDropNode', 'moveNodes', 'moveNodesBy', 'finishLinking'];
    if (context.modelActionTypes.some((a) => blocked.includes(a))) {
      cancel();
      return;
    }
    next();
  },
};

@Component({
  selector: 'ks-taste-map-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgDiagramComponent, NgDiagramBackgroundComponent, NgDiagramMinimapComponent],
  providers: [provideNgDiagram()],
  styles: `
    .stage { display: flex; height: 72vh; border-radius: var(--ks-radius); border: 1px solid var(--ks-border); overflow: hidden; position: relative; }
  `,
  template: `
    <h1 class="font-display text-4xl uppercase mb-2">{{ network() ? 'Sieć twórcy' : 'Mapa gustu' }}</h1>
    <p class="text-sm text-ks-muted mb-3">
      @if (network()) {
        Obejrzane tytuły twórcy i współpracownicy z co najmniej 2 wspólnych tytułów.
        <button type="button" class="underline text-ks-accent ml-1" (click)="closeNetwork()">Wróć do mapy gustu</button>
      } @else {
        Ty → gatunki → najczęstsi twórcy w gatunku. Kliknij osobę, aby rozwinąć jej tytuły. Rozmiar = liczba tytułów, kolor = Twoja średnia ocena.
      }
    </p>
    @if (graph().nodes.length <= 1) {
      <p class="ks-card p-6 text-ks-muted">Za mało danych, aby narysować graf dla wybranych filtrów.</p>
    } @else {
      <!-- Re-create the diagram whenever the graph changes (filters, expansion). -->
      @for (m of [model()]; track m) {
        <div class="stage ks-diagram">
          <ng-diagram [model]="m" [config]="config" [nodeTemplateMap]="templates" [middlewares]="middlewares"
            (selectionChanged)="onSelect($event)">
            <ng-diagram-background type="dots" />
          </ng-diagram>
          <ng-diagram-minimap />
        </div>
      }
      <p class="text-xs text-ks-muted mt-2">{{ graph().nodes.length }} węzłów (limit 150). Przeciągaj tło, aby przesuwać; kółko myszy przybliża.</p>
    }
  `,
})
export class TasteMapPage {
  private readonly fs = inject(FiltersStore);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  /** Person key from ?siec=… (creator card → "Pokaż sieć twórcy"). */
  readonly siec = input<string>();
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly network = computed(() => this.siec() ?? null);

  readonly templates = new NgDiagramNodeTemplateMap([['taste', TasteNode]]);
  readonly middlewares = [READ_ONLY];
  readonly config = {
    zoom: { min: 0.05, max: 3, zoomToFit: { onInit: true, padding: 40 } },
    // Virtualization disables zoom-to-fit; with ≤ 150 nodes it is not needed (see docs/adr/0001).
    virtualization: { enabled: false },
  };

  constructor() {
    // ng-diagram needs its global stylesheet (CSS variables); it is built as a separate,
    // non-injected bundle and attached only when this lazy view is opened.
    if (!document.getElementById('ng-diagram-styles')) {
      const link = document.createElement('link');
      link.id = 'ng-diagram-styles';
      link.rel = 'stylesheet';
      link.href = 'ng-diagram.css';
      document.head.appendChild(link);
    }
  }

  readonly graph = computed<Graph>(() => {
    const items = this.fs.filtered();
    const key = this.network();
    return key ? creatorNetwork(items, key) : tasteGraph(items, { expanded: this.expanded() });
  });

  readonly model = computed(() => {
    const g = this.graph();
    // initializeModel touches ng-diagram's internal signals – keep them out of this computed's dependencies.
    return untracked(() => initializeModel(
      {
        nodes: g.nodes.map((n) => ({
          id: n.id,
          type: 'taste',
          position: { x: n.x, y: n.y },
          data: { ...n },
          draggable: false,
          resizable: false,
          rotatable: false,
        })),
        edges: g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourcePort: 'out', targetPort: 'in', data: {} })),
      },
      this.injector,
    ));
  });

  onSelect(e: SelectionChangedEvent): void {
    const node = e.selectedNodes[0];
    if (!node || this.network()) return;
    const data = node.data as { expandable?: boolean };
    if (!data.expandable) return;
    const next = new Set(this.expanded());
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    this.expanded.set(next);
  }

  closeNetwork(): void {
    void this.router.navigate([], { queryParams: { siec: null }, queryParamsHandling: 'merge' });
  }
}
