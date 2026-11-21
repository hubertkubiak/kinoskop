import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataResetService } from '../core/data-reset.service';
import { AI_PROVIDERS } from './ai-models.config';
import { AiKeyStore } from './ai-key.store';

const KEY = 'kinoskop-ai-v1';

describe('AiKeyStore', () => {
  let resetHooks: (() => void)[];

  function create(): AiKeyStore {
    resetHooks = [];
    TestBed.configureTestingModule({
      providers: [{ provide: DataResetService, useValue: { onReset: (h: () => void) => resetHooks.push(h) } }],
    });
    return TestBed.inject(AiKeyStore);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps the key in memory only by default (SPEC §7.11)', () => {
    const store = create();
    store.setKey('  sk-test-1234567890  ');
    expect(store.apiKey()).toBe('sk-test-1234567890');
    expect(store.ready()).toBe(true);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(document.cookie).not.toContain('sk-test');
  });

  it('remembers the key in sessionStorage only when asked, and restores it', () => {
    const store = create();
    store.setKey('sk-test-1234567890');
    store.setRemember(true);
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toMatchObject({ provider: 'anthropic', apiKey: 'sk-test-1234567890' });

    TestBed.resetTestingModule();
    const restored = create();
    expect(restored.apiKey()).toBe('sk-test-1234567890');
    expect(restored.remember()).toBe(true);

    restored.setRemember(false);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('treats short keys as not ready', () => {
    const store = create();
    store.setKey('abc');
    expect(store.ready()).toBe(false);
  });

  it('changing the provider resets the key and picks its first model', () => {
    const store = create();
    store.setKey('sk-test-1234567890');
    store.setProvider('openrouter');
    const openrouter = AI_PROVIDERS.find((p) => p.id === 'openrouter');
    expect(store.apiKey()).toBe('');
    expect(store.model()).toBe(openrouter?.models[0].id);
    expect(store.info().id).toBe('openrouter');
  });

  it('is cleared by "Usuń moje dane"', () => {
    const store = create();
    store.setKey('sk-test-1234567890');
    store.setRemember(true);
    expect(resetHooks).toHaveLength(1);
    resetHooks[0]();
    expect(store.apiKey()).toBe('');
    expect(store.remember()).toBe(false);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('survives unavailable storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = create();
    store.setKey('sk-test-1234567890');
    expect(() => store.setRemember(true)).not.toThrow();
    spy.mockRestore();
  });
});
