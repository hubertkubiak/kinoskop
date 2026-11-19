import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type Affinity, type AffinityKind, collaboratorsOf, directorActorDuos, tasteAffinities } from '@kinoskop/stats';
import { FiltersStore } from '../../core/filters.store';
import { countryName, fmtAvg } from '../../core/format';
import { Poster } from '../../ui/poster';
import { Ticket } from '../../ui/ticket';

const KINDS: { kind: AffinityKind; label: string }[] = [
  { kind: 'genre', label: 'Gatunki' },
  { kind: 'country', label: 'Kraje produkcji' },
  { kind: 'director', label: 'Reżyserzy' },
  { kind: 'cast', label: 'Aktorzy' },
];
const PER_KIND = 6;
const MIN_TITLES = 5;

/**
 * "Twój gust" (SPEC §7.8, docs/adr/0002): ranked lists of what goes together with the user's
 * higher and lower ratings, director–actor duos and – with ?siec=<person> – a creator's collaborators.
 */
@Component({
  selector: 'ks-taste-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Poster, RouterLink, Ticket],
  template: `
    @if (network(); as net) {
      <h1 class="font-display text-4xl uppercase mb-2">Współpracownicy: {{ net.person?.name ?? 'twórca' }}</h1>
      <p class="text-sm text-ks-muted mb-4">
        Osoby, z którymi ten twórca pracował w co najmniej 2 obejrzanych przez Ciebie tytułach.
        <a routerLink="/gust" class="underline text-ks-accent ml-1">Wróć do „Twój gust”</a>
      </p>
      <ul class="grid gap-3 md:grid-cols-2">
        @for (c of net.collaborators; track c.key) {
          <li class="ks-card p-3 flex gap-3">
            <ks-poster class="w-12 h-16 shrink-0" [src]="c.person.profileUrl" [title]="c.person.name" />
            <div class="min-w-0 flex-1">
              <p class="font-semibold">
                <button type="button" class="hover:underline text-left" (click)="openNetwork(c.key)">{{ c.person.name }}</button>
              </p>
              <p class="text-xs text-ks-muted tabular mb-1">{{ c.titles.length }} wspólnych tytułów · Twoja śr. {{ avg(c.avg) }}</p>
              <p class="text-sm truncate">{{ titlesText(c.titles) }}</p>
            </div>
          </li>
        } @empty {
          <li class="ks-card p-4 text-ks-muted">Brak osób z co najmniej 2 wspólnymi tytułami.</li>
        }
      </ul>
    } @else {
      <h1 class="font-display text-4xl uppercase mb-2">Twój gust</h1>
      <p class="text-sm text-ks-muted mb-5">
        Co sprawia, że oceniasz wyżej lub niżej niż zwykle (Twoja średnia: <strong class="tabular">{{ avg(aff().overall) }}</strong>).
        Brane są pod uwagę cechy z co najmniej {{ minTitles }} ocenionymi tytułami; mała liczba tytułów jest „ściągana” w stronę średniej, żeby przypadek nie wygrywał.
      </p>

      @for (side of sides(); track side.title) {
        <section class="mb-6" [attr.aria-label]="side.title">
          <h2 class="font-display text-2xl uppercase mb-3">{{ side.title }}</h2>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            @for (group of side.groups; track group.kind) {
              <div class="ks-card p-4">
                <h3 class="font-semibold mb-2">{{ group.label }}</h3>
                <ol class="space-y-1.5">
                  @for (a of group.rows; track a.key) {
                    <li class="flex items-center gap-2 text-sm">
                      @if (a.person) {
                        <button type="button" class="flex-1 truncate text-left hover:underline" (click)="openNetwork(a.key)">{{ a.label }}</button>
                      } @else {
                        <span class="flex-1 truncate">{{ label(a) }}</span>
                      }
                      <span class="text-ks-muted tabular" [attr.aria-label]="a.n + ' tytułów'">{{ a.n }}×</span>
                      <span class="tabular w-12 text-right" [class.text-ks-positive]="a.lift > 0" [class.text-ks-negative]="a.lift < 0">
                        {{ a.lift > 0 ? '+' : '−' }}{{ avg(abs(a.lift)) }}
                      </span>
                    </li>
                  } @empty {
                    <li class="text-sm text-ks-muted">Nic wyraźnego.</li>
                  }
                </ol>
              </div>
            }
          </div>
        </section>
      }
      <p class="text-xs text-ks-muted mb-6">
        Liczba po prawej to o ile punktów wyżej (+) lub niżej (−) niż zwykle oceniasz tytuły z tą cechą. „5×” = 5 ocenionych tytułów.
        Kliknij osobę, aby zobaczyć jej współpracowników.
      </p>

      <section class="ks-card p-4" aria-labelledby="ks-duos">
        <h2 id="ks-duos" class="font-display text-2xl uppercase mb-1">Sprawdzone duety</h2>
        <p class="text-sm text-ks-muted mb-3">Reżyser i aktor z co najmniej 3 wspólnymi tytułami spośród ocenionych.</p>
        <ol class="grid gap-x-6 gap-y-2 md:grid-cols-2">
          @for (d of duos(); track d.director.name + d.actor.name) {
            <li class="flex items-center gap-3 text-sm">
              <ks-ticket [rating]="round(d.avg)" />
              <span class="flex-1 min-w-0">
                <span class="font-semibold">{{ d.director.name }}</span> × {{ d.actor.name }}
                <span class="block text-xs text-ks-muted truncate">{{ titlesText(d.titles) }}</span>
              </span>
              <span class="text-ks-muted tabular">{{ d.titles.length }}×</span>
            </li>
          } @empty {
            <li class="text-sm text-ks-muted">Brak duetów z co najmniej 3 wspólnymi tytułami.</li>
          }
        </ol>
      </section>
    }
  `,
})
export class TastePage {
  private readonly fs = inject(FiltersStore);
  private readonly router = inject(Router);
  readonly avg = fmtAvg;
  readonly abs = Math.abs;
  readonly minTitles = MIN_TITLES;

  /** Person key from ?siec=… (creator card → "Pokaż współpracowników"). */
  readonly siec = input<string>();

  readonly aff = computed(() => tasteAffinities(this.fs.filtered(), MIN_TITLES));
  readonly sides = computed(() => {
    const a = this.aff();
    const group = (rows: Affinity[]) =>
      KINDS.map((k) => ({ ...k, rows: rows.filter((r) => r.kind === k.kind).slice(0, PER_KIND) }));
    return [
      { title: 'Podnosi Twoje oceny', groups: group(a.boosts) },
      { title: 'Obniża Twoje oceny', groups: group(a.drags) },
    ];
  });
  readonly duos = computed(() => directorActorDuos(this.fs.filtered(), 3).slice(0, 16));
  readonly network = computed(() => {
    const key = this.siec();
    return key ? collaboratorsOf(this.fs.filtered(), key) : null;
  });

  label(a: Affinity): string {
    return a.kind === 'country' ? countryName(a.label) : a.label;
  }

  round(x: number | undefined): number | undefined {
    return x === undefined ? undefined : Math.round(x);
  }

  titlesText(titles: { title: string; rating?: number }[]): string {
    return titles.map((t) => (t.rating ? `${t.title} (${t.rating})` : t.title)).join(', ');
  }

  openNetwork(key: string): void {
    void this.router.navigate(['/gust'], { queryParams: { siec: key }, queryParamsHandling: 'merge' });
  }
}
