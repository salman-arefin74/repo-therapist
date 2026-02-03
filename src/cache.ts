import { RepoAnalysis } from "./types.js";
import { RepoSnapshot } from "./scanner/types.js";
import { GitHistory } from "./historian/types.js";

/**
 * Cached data for a repository
 */
export interface CachedRepo {
  analysis: RepoAnalysis;
  snapshot: RepoSnapshot;
  history: GitHistory | null;
}

/**
 * Simple in-memory cache for analyzed repositories
 * Can be extended to persist to JSON files
 */
export class RepoCache {
  private cache: Map<string, CachedRepo> = new Map();
  private lastAnalyzedPath: string | null = null;

  set(path: string, analysis: RepoAnalysis, snapshot: RepoSnapshot, history: GitHistory | null): void {
    this.cache.set(path, { analysis, snapshot, history });
    this.lastAnalyzedPath = path;
  }

  get(path?: string): RepoAnalysis | null {
    const targetPath = path || this.lastAnalyzedPath;
    if (!targetPath) return null;
    return this.cache.get(targetPath)?.analysis || null;
  }

  getSnapshot(path?: string): RepoSnapshot | null {
    const targetPath = path || this.lastAnalyzedPath;
    if (!targetPath) return null;
    return this.cache.get(targetPath)?.snapshot || null;
  }

  getHistory(path?: string): GitHistory | null {
    const targetPath = path || this.lastAnalyzedPath;
    if (!targetPath) return null;
    return this.cache.get(targetPath)?.history || null;
  }

  getCached(path?: string): CachedRepo | null {
    const targetPath = path || this.lastAnalyzedPath;
    if (!targetPath) return null;
    return this.cache.get(targetPath) || null;
  }

  getLastPath(): string | null {
    return this.lastAnalyzedPath;
  }

  has(path: string): boolean {
    return this.cache.has(path);
  }

  clear(): void {
    this.cache.clear();
    this.lastAnalyzedPath = null;
  }
}
