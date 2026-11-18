import { computed, inject, Injectable, signal } from '@angular/core';
import { buildEraPrompt, ERA_BATCH_SIZE, type EraPromptItem, parseEraResponse } from '@kinoskop/shared';
import { displayTitle, type LibraryItem, withoutEra } from '@kinoskop/stats';
import { LibraryStore } from '../core/library.store';
import { AI_PROVIDERS, SYSTEM_PROMPT_TOKENS, TOKENS_PER_TITLE } from './ai-models.config';
import { AiKeyStore } from './ai-key.store';
import { loadAdapter, ProviderError } from './providers/provider';

export type ClassifierState = 'idle' | 'running' | 'done' | 'stopped' | 'error';

/**
 * AI era classification (SPEC §7.11): user-started, batches of 20, progress, abort and resume
 * (titles already attempted are skipped). Results go to IndexedDB marked `source: 'ai'`.
 */
@Injectable({ providedIn: 'root' })
export class EraClassifier {
  private readonly store = inject(LibraryStore);
  private readonly key = inject(AiKeyStore);
  private abort: AbortController | null = null;

  readonly state = signal<ClassifierState>('idle');
  readonly done = signal(0);
  readonly total = signal(0);
  readonly classified = signal(0);
  readonly rejected = signal(0);
  readonly error = signal<string | null>(null);

  /** Titles without an era from any source and not yet tried by AI in this session. */
  readonly pending = computed(() => {
    const attempted = this.store.aiEras();
    return withoutEra(this.store.library()).filter((i) => !attempted.get(i.key)?.attempted);
  });

  readonly estimate = computed(() => {
    const n = this.pending().length;
    const requests = Math.ceil(n / ERA_BATCH_SIZE);
    const model = AI_PROVIDERS.find((p) => p.id === this.key.provider())?.models.find((m) => m.id === this.key.model());
    const inTok = n * TOKENS_PER_TITLE.input + requests * SYSTEM_PROMPT_TOKENS;
    const outTok = n * TOKENS_PER_TITLE.output;
    const cost = model?.price ? (inTok * model.price.input + outTok * model.price.output) / 1e6 : undefined;
    return { titles: n, requests, costUsd: cost };
  });

  async run(): Promise<void> {
    if (this.state() === 'running' || !this.key.ready()) return;
    const items = this.pending();
    this.abort = new AbortController();
    this.state.set('running');
    this.error.set(null);
    this.done.set(0);
    this.total.set(items.length);
    this.classified.set(0);
    this.rejected.set(0);
    try {
      const adapter = await loadAdapter(this.key.provider());
      for (let i = 0; i < items.length; i += ERA_BATCH_SIZE) {
        if (this.abort.signal.aborted) {
          this.state.set('stopped');
          return;
        }
        const batch = items.slice(i, i + ERA_BATCH_SIZE);
        const prompt = buildEraPrompt(batch.map(toPromptItem));
        const reply = await adapter({
          ...prompt,
          model: this.key.model(),
          apiKey: this.key.apiKey(),
          signal: this.abort.signal,
        });
        const ids = batch.map((b) => b.filmwebId);
        const parsed = parseEraResponse(reply, ids);
        const byId = new Map(parsed.answers.map((a) => [a.filmwebId, a]));
        // Every title in the batch is marked as attempted, also when the answer was invalid.
        await this.store.setAiEras(
          batch.map((b) => ({ key: b.key, eras: (byId.get(b.filmwebId)?.eras ?? []).map((key) => ({ key, source: 'ai' as const })) })),
        );
        this.classified.update((c) => c + parsed.answers.length);
        this.rejected.update((r) => r + parsed.rejected);
        this.done.update((d) => d + batch.length);
      }
      this.state.set('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        this.state.set('stopped');
        return;
      }
      this.error.set(e instanceof ProviderError ? e.message : 'Nieoczekiwany błąd klasyfikacji.');
      this.state.set('error');
    } finally {
      this.abort = null;
    }
  }

  stop(): void {
    this.abort?.abort();
  }
}

function toPromptItem(i: LibraryItem): EraPromptItem {
  const e = i.enrichment;
  return {
    filmwebId: i.filmwebId,
    title: displayTitle(i),
    originalTitle: e?.originalTitle ?? i.originalTitle,
    year: i.year ?? e?.year,
    overview: e?.overview,
    keywords: e?.keywords,
  };
}
