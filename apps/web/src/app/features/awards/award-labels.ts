import { computed, inject, Injectable, signal } from '@angular/core';
import { type AwardCatalog, AwardCatalogSchema } from '@kinoskop/shared';
import { ApiClient } from '../../core/api.client';

/**
 * Award catalogue, loaded once per session: from GET /api/awards, falling back to the static
 * copy bundled with the app (same file the API serves), so awards work while the API sleeps.
 */
@Injectable({ providedIn: 'root' })
export class AwardLabels {
  private readonly api = inject(ApiClient);
  private loading: Promise<void> | null = null;
  readonly catalog = signal<AwardCatalog | null>(null);
  readonly error = signal(false);

  private readonly byKey = computed(() => new Map((this.catalog()?.awards ?? []).map((a) => [a.key, a])));

  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        this.catalog.set(await this.api.awards());
      } catch {
        try {
          const res = await fetch('data/awards.json');
          this.catalog.set(AwardCatalogSchema.parse(await res.json()));
        } catch {
          this.error.set(true);
        }
      }
    })();
    return this.loading;
  }

  short(key: string): string {
    void this.load();
    return this.byKey().get(key)?.shortPl ?? key;
  }
}
