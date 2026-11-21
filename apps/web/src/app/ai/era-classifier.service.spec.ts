import { TestBed } from '@angular/core/testing';
import { ERA_BATCH_SIZE } from '@kinoskop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore } from '../core/library.store';
import { enrichment, exportFile, exportItem } from '../testing/fixtures';
import { AiKeyStore } from './ai-key.store';
import { EraClassifier } from './era-classifier.service';
import type { ClassifyRequest } from './providers/provider';
import { ProviderError } from './providers/provider';

const adapter = vi.fn<(req: ClassifyRequest) => Promise<string>>();

vi.mock('./providers/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./providers/provider')>()),
  loadAdapter: async () => adapter,
}));

/** Model reply: every id in the prompt gets the given era. */
const replyAll = (era: string) => async (req: ClassifyRequest) => {
  const ids = [...req.user.matchAll(/"filmwebId":\s*(\d+)/g)].map((m) => Number(m[1]));
  return JSON.stringify(ids.map((filmwebId) => ({ filmwebId, eras: [era], confidence: 0.9 })));
};

describe('EraClassifier', () => {
  let store: LibraryStore;
  let key: AiKeyStore;
  let classifier: EraClassifier;

  beforeEach(async () => {
    adapter.mockReset();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(LibraryStore);
    key = TestBed.inject(AiKeyStore);
    classifier = TestBed.inject(EraClassifier);
    const n = ERA_BATCH_SIZE + 5;
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    await store.loadExport(
      exportFile([...ids.map((id) => exportItem(id)), exportItem(999)]),
      'import',
      // 999 already has an era from Wikidata and is not sent.
      [...ids.map((id) => enrichment(id)), enrichment(999, { setInPeriod: [{ key: 'antiquity', source: 'wikidata' }] })],
    );
  });

  it('lists only titles without an era and estimates requests', () => {
    expect(classifier.pending()).toHaveLength(ERA_BATCH_SIZE + 5);
    expect(classifier.estimate()).toMatchObject({ titles: ERA_BATCH_SIZE + 5, requests: 2 });
    expect(classifier.estimate().costUsd).toBeGreaterThan(0);
  });

  it('does not run without a key', async () => {
    await classifier.run();
    expect(adapter).not.toHaveBeenCalled();
    expect(classifier.state()).toBe('idle');
  });

  it('classifies in batches, stores AI eras and skips attempted titles next time', async () => {
    key.setKey('sk-test-1234567890');
    adapter.mockImplementation(replyAll('middle-ages'));
    await classifier.run();

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[0][0]).toMatchObject({ apiKey: 'sk-test-1234567890', model: key.model() });
    expect(adapter.mock.calls[0][0].user).not.toContain('"filmwebId": 999');
    expect(classifier.state()).toBe('done');
    expect(classifier.classified()).toBe(ERA_BATCH_SIZE + 5);
    expect(store.library()[0].enrichment?.setInPeriod).toEqual([{ key: 'middle-ages', source: 'ai' }]);
    expect(classifier.pending()).toHaveLength(0);
  });

  it('marks titles with an invalid answer as attempted without inventing eras', async () => {
    key.setKey('sk-test-1234567890');
    adapter.mockResolvedValue('nie wiem');
    await classifier.run();
    expect(classifier.classified()).toBe(0);
    expect(classifier.rejected()).toBe(ERA_BATCH_SIZE + 5);
    expect(store.aiEras().get('film:1')).toEqual({ key: 'film:1', eras: [], attempted: true });
  });

  it('shows provider errors and stops', async () => {
    key.setKey('sk-test-1234567890');
    adapter.mockRejectedValue(new ProviderError('Nieprawidłowy klucz.', 'auth'));
    await classifier.run();
    expect(classifier.state()).toBe('error');
    expect(classifier.error()).toBe('Nieprawidłowy klucz.');
  });

  it('can be stopped between batches', async () => {
    key.setKey('sk-test-1234567890');
    adapter.mockImplementation(async (req) => {
      classifier.stop();
      return replyAll('renaissance')(req);
    });
    await classifier.run();
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(classifier.state()).toBe('stopped');
    expect(classifier.pending()).toHaveLength(5);
  });
});
