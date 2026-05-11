/**
 * In-process LRU cache for inference router calls.
 *
 * For V1 this is a Map-backed LRU. The eventual production cache backs
 * onto Postgres (`inference_audit` rows with `cache_hit=true` are served
 * by a planner before the router dispatches a fresh call), but for dev
 * + tests an in-memory cache makes the loop visibly snappy without DB.
 *
 * Cache invalidation:
 *   - LRU eviction when MAX_ENTRIES exceeded
 *   - TTL evict on read when entry is older than `routing.cacheTtlSeconds`
 *   - Recipe-version bump via env invalidates everything (hash key includes
 *     the recipe version; new hashes don't collide with old)
 */

import type { InferenceResult } from "./types.js";

interface CacheEntry {
  result: InferenceResult;
  insertedAt: number; // epoch ms
  ttlMs: number;
}

const MAX_ENTRIES = 1000;

class LruCache {
  private readonly store = new Map<string, CacheEntry>();

  get(key: string): InferenceResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // TTL check
    if (Date.now() - entry.insertedAt > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }

    // LRU touch: re-insert moves to end
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.result;
  }

  set(key: string, result: InferenceResult, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return; // non-cacheable task: don't store
    if (this.store.size >= MAX_ENTRIES) {
      // Evict oldest (first inserted = first in Map iteration order)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      result,
      insertedAt: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const inferenceCache = new LruCache();
