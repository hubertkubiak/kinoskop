import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KIND_LABELS, type SearchCandidate } from '@kinoskop/shared';
import { displayTitle, type LibraryItem } from '@kinoskop/stats';
import { ApiClient } from '../../../core/api.client';
import { LibraryStore } from '../../../core/library.store';
import { fmtAvg } from '../../../core/format';
import { Poster } from '../../../ui/poster/poster';

export const VERIFY_THRESHOLD = 0.8;

interface SearchState {
  key: string;
  query: string;
  loading: boolean;
  error?: string;
  candidates: SearchCandidate[];
}

/** Match verification (SPEC §7.10): low-confidence or unmatched titles with manual search. */
@Component({
  selector: 'ks-verification-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Poster],
  templateUrl: './verification-page.html',
})
export class VerificationPage {
  private readonly store = inject(LibraryStore);
  private readonly api = inject(ApiClient);
  readonly kindLabels = KIND_LABELS;
  readonly pct = (n: number) => `${Math.round(n * 100)}%`;
  readonly avg = fmtAvg;
  readonly search = signal<SearchState | null>(null);
  readonly saving = signal<string | null>(null);

  readonly items = computed(() =>
    this.store
      .library()
      .filter((i) => !i.enrichment || i.enrichment.match.confidence < VERIFY_THRESHOLD)
      .sort((a, b) => (a.enrichment?.match.confidence ?? -1) - (b.enrichment?.match.confidence ?? -1)),
  );

  title(i: LibraryItem) {
    return displayTitle(i);
  }

  async openSearch(i: LibraryItem, query?: string): Promise<void> {
    const q = (query ?? i.originalTitle ?? i.title ?? i.enrichment?.originalTitle ?? i.enrichment?.title ?? '').trim();
    this.search.set({ key: i.key, query: q, loading: !!q, candidates: [] });
    if (!q) return;
    try {
      const res = await this.api.search({ q, kind: i.kind, year: i.year });
      this.search.update((s) => s && s.key === i.key ? { ...s, loading: false, candidates: res.candidates } : s);
    } catch {
      this.search.update((s) => s && { ...s, loading: false, error: 'Wyszukiwarka niedostępna (sprawdź, czy API działa i ma klucz TMDB/IGDB).' });
    }
  }

  async choose(i: LibraryItem, c: SearchCandidate): Promise<void> {
    this.saving.set(i.key);
    try {
      const e = await this.api.manualMatch({ filmwebId: i.filmwebId, kind: i.kind, tmdbId: c.tmdbId, igdbId: c.igdbId });
      await this.store.setOverride(i.key, e);
      this.search.set(null);
    } finally {
      this.saving.set(null);
    }
  }

  /** Accepts the current proposal as correct (stored as a manual override with confidence 1). */
  async accept(i: LibraryItem): Promise<void> {
    if (!i.enrichment) return;
    await this.store.setOverride(i.key, { ...i.enrichment, match: { ...i.enrichment.match, method: 'manual', confidence: 1 } });
  }
}
