import { describe, it, expect, beforeEach } from "vitest";
import { RepoCache } from "../src/cache.js";
import type { RepoAnalysis } from "../src/types.js";
import type { RepoSnapshot } from "../src/scanner/types.js";
import type { GitHistory } from "../src/historian/types.js";

describe("RepoCache", () => {
  let cache: RepoCache;

  // Mock data
  const mockAnalysis: RepoAnalysis = {
    path: "/test/repo",
    name: "test-repo",
    analyzedAt: new Date().toISOString(),
    structure: {
      hasReadme: true,
      hasPackageJson: true,
      hasTsConfig: true,
      hasGitIgnore: true,
      topLevelDirs: ["src", "tests"],
      configFiles: ["package.json", "tsconfig.json"],
      entryPoints: ["src/index.ts"],
    },
    codeMetrics: {
      totalFiles: 10,
      totalLines: 500,
      filesByExtension: { ".ts": 8, ".json": 2 },
      largestFiles: [],
      averageFileSize: 1000,
    },
    gitMetrics: null,
    dependencies: [],
    risks: [],
    techStack: ["TypeScript", "Node.js"],
  };

  const mockSnapshot: RepoSnapshot = {
    snapshotVersion: "1.0",
    createdAt: new Date().toISOString(),
    repoPath: "/test/repo",
    repoName: "test-repo",
    files: [],
    totalFiles: 10,
    totalLines: 500,
    totalSize: 10000,
    languages: [{ name: "TypeScript", extensions: [".ts"], fileCount: 8, lineCount: 400, percentage: 80 }],
    primaryLanguage: "TypeScript",
    entryPoints: [],
    configs: {
      packageJson: null,
      tsConfig: null,
      additionalTsConfigs: [],
      dockerfile: null,
      dockerCompose: null,
      ci: [],
      eslint: null,
      prettier: null,
      gitignore: null,
      envExample: null,
      other: [],
    },
    directories: [],
  };

  const mockHistory: GitHistory = {
    historyVersion: "1.0",
    analyzedAt: new Date().toISOString(),
    repoPath: "/test/repo",
    totalCommits: 100,
    totalAuthors: 5,
    firstCommit: null,
    lastCommit: null,
    dateRange: null,
    fileChurn: {},
    fileOwnership: {},
    authorStats: {},
    hotPaths: [],
    stableCore: [],
    fragileFiles: [],
    commitPattern: {
      type: "steady",
      description: "Steady development",
      averageCommitsPerWeek: 5,
      longestGapDays: 7,
      busiestPeriod: null,
    },
    recentCommits: [],
    timeline: [],
    highChurnFiles: [],
    multiAuthorFiles: [],
    recentlyFragile: [],
  };

  beforeEach(() => {
    cache = new RepoCache();
  });

  describe("set and get", () => {
    it("should store and retrieve analysis", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.get("/test/repo");
      expect(retrieved).toEqual(mockAnalysis);
    });

    it("should store and retrieve snapshot", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.getSnapshot("/test/repo");
      expect(retrieved).toEqual(mockSnapshot);
    });

    it("should store and retrieve history", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.getHistory("/test/repo");
      expect(retrieved).toEqual(mockHistory);
    });

    it("should handle null history", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, null);

      const retrieved = cache.getHistory("/test/repo");
      expect(retrieved).toBeNull();
    });
  });

  describe("lastAnalyzedPath", () => {
    it("should track last analyzed path", () => {
      cache.set("/test/repo1", mockAnalysis, mockSnapshot, mockHistory);

      expect(cache.getLastPath()).toBe("/test/repo1");

      const analysis2 = { ...mockAnalysis, path: "/test/repo2" };
      cache.set("/test/repo2", analysis2, mockSnapshot, mockHistory);

      expect(cache.getLastPath()).toBe("/test/repo2");
    });

    it("should return data from last analyzed path when no path specified", () => {
      cache.set("/test/repo1", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.get();
      expect(retrieved).toEqual(mockAnalysis);
    });

    it("should return snapshot from last analyzed path when no path specified", () => {
      cache.set("/test/repo1", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.getSnapshot();
      expect(retrieved).toEqual(mockSnapshot);
    });

    it("should return history from last analyzed path when no path specified", () => {
      cache.set("/test/repo1", mockAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.getHistory();
      expect(retrieved).toEqual(mockHistory);
    });
  });

  describe("has", () => {
    it("should return true for cached path", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      expect(cache.has("/test/repo")).toBe(true);
    });

    it("should return false for uncached path", () => {
      expect(cache.has("/nonexistent")).toBe(false);
    });
  });

  describe("getCached", () => {
    it("should return full cached object", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      const cached = cache.getCached("/test/repo");
      expect(cached).toEqual({
        analysis: mockAnalysis,
        snapshot: mockSnapshot,
        history: mockHistory,
      });
    });

    it("should return null for uncached path", () => {
      const cached = cache.getCached("/nonexistent");
      expect(cached).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear all cached data", () => {
      cache.set("/test/repo1", mockAnalysis, mockSnapshot, mockHistory);
      cache.set("/test/repo2", mockAnalysis, mockSnapshot, mockHistory);

      cache.clear();

      expect(cache.get("/test/repo1")).toBeNull();
      expect(cache.get("/test/repo2")).toBeNull();
      expect(cache.getLastPath()).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should return null when no data cached", () => {
      expect(cache.get()).toBeNull();
      expect(cache.getSnapshot()).toBeNull();
      expect(cache.getHistory()).toBeNull();
    });

    it("should overwrite existing data for same path", () => {
      cache.set("/test/repo", mockAnalysis, mockSnapshot, mockHistory);

      const updatedAnalysis = { ...mockAnalysis, name: "updated-repo" };
      cache.set("/test/repo", updatedAnalysis, mockSnapshot, mockHistory);

      const retrieved = cache.get("/test/repo");
      expect(retrieved!.name).toBe("updated-repo");
    });
  });
});
