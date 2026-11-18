import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Cache of PUBLIC metadata only (SPEC §8.4 p.4). Never stores anything identifying a user:
 * keys are `namespace` + title/person id, values are public metadata.
 */
export interface CacheStore {
  get<T>(namespace: string, key: string): T | undefined;
  set(namespace: string, key: string, value: unknown, ttlMs: number): void;
  close(): void;
}

export const DAY = 24 * 60 * 60 * 1000;

export class SqliteCacheStore implements CacheStore {
  private readonly db: Database.Database;
  private readonly getStmt: Database.Statement<[string, string], { value: string; expires_at: number }>;
  private readonly setStmt: Database.Statement<[string, string, string, number]>;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`CREATE TABLE IF NOT EXISTS cache (
      ns TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL,
      PRIMARY KEY (ns, key))`);
    this.getStmt = this.db.prepare('SELECT value, expires_at FROM cache WHERE ns = ? AND key = ?');
    this.setStmt = this.db.prepare(
      'INSERT INTO cache (ns, key, value, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(ns, key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
    );
  }

  get<T>(namespace: string, key: string): T | undefined {
    const row = this.getStmt.get(namespace, key);
    if (!row || row.expires_at < Date.now()) return undefined;
    return JSON.parse(row.value) as T;
  }

  set(namespace: string, key: string, value: unknown, ttlMs: number): void {
    this.setStmt.run(namespace, key, JSON.stringify(value), Date.now() + ttlMs);
  }

  close(): void {
    this.db.close();
  }
}

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, { value: unknown; expiresAt: number }>();
  get<T>(namespace: string, key: string): T | undefined {
    const hit = this.map.get(`${namespace}\u0000${key}`);
    return hit && hit.expiresAt >= Date.now() ? (hit.value as T) : undefined;
  }
  set(namespace: string, key: string, value: unknown, ttlMs: number): void {
    this.map.set(`${namespace}\u0000${key}`, { value: structuredClone(value), expiresAt: Date.now() + ttlMs });
  }
  close(): void {
    this.map.clear();
  }
}
