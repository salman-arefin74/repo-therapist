import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { analyzeRepo } from "../../src/tools/analyze-repo.js";
import { repoCache } from "../../src/index.js";
import {
  createTestRepo,
  cleanupTestRepo,
  SAMPLE_PACKAGE_JSON,
  SAMPLE_TSCONFIG,
  SAMPLE_TS_FILE,
} from "../fixtures/setup.js";

describe("Tool: analyzeRepo", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = await createTestRepo({
      name: "analyze-repo-test",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "tsconfig.json": SAMPLE_TSCONFIG,
        "src/index.ts": SAMPLE_TS_FILE,
        "src/utils.ts": "export const utils = {};",
        "tests/index.test.ts": "describe('test', () => {});",
        "README.md": "# Test Project",
      },
      commits: [
        { message: "Add feature", files: { "src/feature.ts": "export const feature = {};" }, author: "Dev" },
        { message: "Fix bug", files: { "src/feature.ts": "export const feature = { fixed: true };" }, author: "Dev" },
      ],
    });
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  beforeEach(() => {
    repoCache.clear();
  });

  describe("Successful Analysis", () => {
    it("should return success status", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully analyzed");
    });

    it("should include summary", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.summary).toBeDefined();
      expect(result.summary!.length).toBeGreaterThan(0);
    });

    it("should include snapshot data", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.snapshot).toBeDefined();
      expect(result.snapshot!.snapshotVersion).toBe("1.0");
      expect(result.snapshot!.totalFiles).toBeGreaterThan(0);
    });

    it("should include history data", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.history).toBeDefined();
      expect(result.history!.totalCommits).toBeGreaterThan(0);
    });

    it("should detect primary language", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.snapshot!.primaryLanguage).toBeDefined();
      // Should be one of the common languages in the test repo
      expect(["TypeScript", "JSON"]).toContain(result.snapshot!.primaryLanguage);
    });

    it("should detect languages", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.snapshot!.languages).toBeDefined();
      expect(result.snapshot!.languages.length).toBeGreaterThan(0);
    });

    it("should detect entry points", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.snapshot!.entryPoints).toBeDefined();
    });

    it("should detect config files", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.snapshot!.configs.hasPackageJson).toBe(true);
      expect(result.snapshot!.configs.hasTsConfig).toBe(true);
    });
  });

  describe("Cache Population", () => {
    it("should populate cache with analysis", async () => {
      await analyzeRepo(testRepoPath);

      const cached = repoCache.get(testRepoPath);
      expect(cached).not.toBeNull();
      expect(cached!.name).toBe("analyze-repo-test");
    });

    it("should populate cache with snapshot", async () => {
      await analyzeRepo(testRepoPath);

      const snapshot = repoCache.getSnapshot(testRepoPath);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.repoName).toBe("analyze-repo-test");
    });

    it("should populate cache with history", async () => {
      await analyzeRepo(testRepoPath);

      const history = repoCache.getHistory(testRepoPath);
      expect(history).not.toBeNull();
    });

    it("should set last analyzed path", async () => {
      await analyzeRepo(testRepoPath);

      expect(repoCache.getLastPath()).toBe(testRepoPath);
    });
  });

  describe("Error Handling", () => {
    it("should throw for non-existent path", async () => {
      await expect(analyzeRepo("/nonexistent/path")).rejects.toThrow("does not exist");
    });

    it("should throw for file path (not directory)", async () => {
      const filePath = `${testRepoPath}/package.json`;
      await expect(analyzeRepo(filePath)).rejects.toThrow("not a directory");
    });
  });

  describe("History Summary", () => {
    it("should include commit pattern in history", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.history!.commitPattern).toBeDefined();
      expect(result.history!.commitPattern.type).toBeDefined();
    });

    it("should include high churn files", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.history!.highChurnFiles).toBeDefined();
      expect(Array.isArray(result.history!.highChurnFiles)).toBe(true);
    });

    it("should include fragile files", async () => {
      const result = await analyzeRepo(testRepoPath);

      expect(result.history!.fragileFiles).toBeDefined();
      expect(Array.isArray(result.history!.fragileFiles)).toBe(true);
    });
  });
});

describe("Tool: analyzeRepo - No Git", () => {
  let noGitRepoPath: string;

  beforeAll(async () => {
    noGitRepoPath = await createTestRepo({
      name: "no-git-analyze-test",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "src/index.ts": SAMPLE_TS_FILE,
      },
      withGit: false,
    });
  });

  afterAll(() => {
    cleanupTestRepo(noGitRepoPath);
  });

  it("should handle repo without git gracefully", async () => {
    const result = await analyzeRepo(noGitRepoPath);

    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.history).toBeNull();
  });

  it("should still populate snapshot without git", async () => {
    const result = await analyzeRepo(noGitRepoPath);

    expect(result.snapshot!.totalFiles).toBeGreaterThan(0);
    expect(result.snapshot!.primaryLanguage).toBeDefined();
  });
});
