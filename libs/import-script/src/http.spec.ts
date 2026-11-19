import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({ DELAY_MS: { min: 0, max: 0 }, MAX_ATTEMPTS: 3 }));

const { BadRequestError, getJson, NotLoggedInError } = await import('./http');

const res = (status: number, body: unknown = []) =>
  ({ status, json: async () => body }) as unknown as Response;

afterEach(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('renews the session once on 401 and retries the request', async () => {
    const fetch = vi.fn<(path: string) => Promise<Response>>()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, '<html>'))
      .mockResolvedValueOnce(res(200, [{ entity: 1 }]));
    vi.stubGlobal('fetch', fetch);
    await expect(getJson('/api/v1/logged/vote/title/film?page=1')).resolves.toEqual([{ entity: 1 }]);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/logged/vote/title/film?page=1',
      '/',
      '/api/v1/logged/vote/title/film?page=1',
    ]);
  });

  it('reports not logged in when 401 persists after renewal', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => (path === '/' ? res(200) : res(401))));
    await expect(getJson('/api/v1/logged/info')).rejects.toBeInstanceOf(NotLoggedInError);
  });

  it('throws BadRequestError on 400 (unknown list kind)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(400, { error: 'x' })));
    await expect(getJson('/api/v1/logged/vote/title/game?page=1')).rejects.toBeInstanceOf(BadRequestError);
  });
});
