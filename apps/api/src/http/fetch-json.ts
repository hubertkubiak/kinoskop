export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch + JSON with timeout and exponential backoff on 429/5xx/network errors.
 * Returns null for 404 (missing resource is not an error for enrichment).
 */
export async function fetchJson<T>(
  source: string,
  url: string,
  init: RequestInit = {},
  { timeoutMs = 10_000, attempts = 3 }: { timeoutMs?: number; attempts?: number } = {},
): Promise<T | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < attempts) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }
      throw new UpstreamError(source, res.status, `${source} responded ${res.status}`);
    } catch (e) {
      if (e instanceof UpstreamError || attempt >= attempts) {
        throw e instanceof UpstreamError ? e : new UpstreamError(source, 0, `${source}: ${(e as Error).message}`);
      }
      await sleep(500 * 2 ** attempt);
    }
  }
}
