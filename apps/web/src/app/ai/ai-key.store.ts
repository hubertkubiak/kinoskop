import { computed, inject, Injectable, signal } from '@angular/core';
import { DataResetService } from '../core/data-reset.service';
import { AI_PROVIDERS, type ProviderId } from './ai-models.config';

const SESSION_KEY = 'kinoskop-ai-v1';

interface Persisted {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

/**
 * The user's AI key (BYOK, SPEC §7.11). Held in memory (a signal) by default; only when the user
 * ticks "Zapamiętaj do zamknięcia karty" it goes to sessionStorage. Never IndexedDB, cookies or URLs,
 * and never sent to /api/*. Cleared by "Usuń klucz" and "Usuń moje dane".
 */
@Injectable({ providedIn: 'root' })
export class AiKeyStore {
  readonly provider = signal<ProviderId>('anthropic');
  readonly model = signal<string>(AI_PROVIDERS[0].models[0].id);
  readonly apiKey = signal('');
  readonly remember = signal(false);

  readonly info = computed(() => AI_PROVIDERS.find((p) => p.id === this.provider())!);
  readonly ready = computed(() => this.apiKey().trim().length > 8);

  constructor() {
    inject(DataResetService).onReset(() => this.clear());
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        this.provider.set(p.provider);
        this.model.set(p.model);
        this.apiKey.set(p.apiKey);
        this.remember.set(true);
      }
    } catch {
      /* storage unavailable */
    }
  }

  setProvider(id: ProviderId): void {
    this.provider.set(id);
    this.model.set(AI_PROVIDERS.find((p) => p.id === id)!.models[0].id);
    this.apiKey.set('');
    this.persist();
  }

  setKey(key: string): void {
    this.apiKey.set(key.trim());
    this.persist();
  }

  setRemember(on: boolean): void {
    this.remember.set(on);
    this.persist();
  }

  persist(): void {
    try {
      if (this.remember() && this.apiKey()) {
        const data: Persisted = { provider: this.provider(), model: this.model(), apiKey: this.apiKey() };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }

  clear(): void {
    this.apiKey.set('');
    this.remember.set(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
