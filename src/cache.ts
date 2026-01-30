import { RepoAnalysis } from "./types.js";

/**
 * Simple in-memory cache for analyzed repositories
 * Can be extended to persist to JSON files
 */
export class RepoCache {
  private cache: Map<string, RepoAnalysis> = new Map();
  private lastAnalyzedPath: string | null = null;

  set(path: string, analysis: RepoAnalysis): void {
    this.cache.set(path, analysis);
    this.lastAnalyzedPath = path;
  }

  get(path?: string): RepoAnalysis | null {
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
