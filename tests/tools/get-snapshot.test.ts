import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getSnapshot } from "../../src/tools/get-snapshot.js";
import { analyzeRepo } from "../../src/tools/analyze-repo.js";
import { repoCache } from "../../src/index.js";
import {
  createTestRepo,
  cleanupTestRepo,
  SAMPLE_PACKAGE_JSON,
  SAMPLE_TSCONFIG,
  SAMPLE_TS_FILE,
} from "../fixtures/setup.js";

describe("Tool: getSnapshot", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = await createTestRepo({
      name: "snapshot-tool-test-repo",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "tsconfig.json": SAMPLE_TSCONFIG,
        "src/index.ts": SAMPLE_TS_FILE,
        "src/utils.ts": "export const utils = {};",
        "tests/index.test.ts": "describe('test', () => {});",
      },
      withGit: true,
    });

    // Analyze the repo first
    await analyzeRepo(testRepoPath);
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  beforeEach(() => {
    // Ensure cache is populated
    // (already done in beforeAll, but this ensures isolation)
  });

  describe("Section: all", () => {
    it("should return summary view by default", async () => {
      const result = await getSnapshot();
      const parsed = JSON.parse(result);

      expect(parsed._citation).toBeDefined();
      expect(parsed._note).toContain("ground truth");
      expect(parsed.metadata).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.languages).toBeDefined();
    });

    it("should include citation and note", async () => {
      const result = await getSnapshot();
      const parsed = JSON.parse(result);

      expect(parsed._citation).toContain("Static snapshot");
      expect(parsed._note).toContain("Do not guess");
    });
  });

  describe("Section: files", () => {
    it("should return file list", async () => {
      const result = await getSnapshot(undefined, "files");
      const parsed = JSON.parse(result);

      expect(parsed.files).toBeDefined();
      expect(Array.isArray(parsed.files)).toBe(true);
      expect(parsed.totalFiles).toBeGreaterThan(0);
    });

    it("should include file metadata", async () => {
      const result = await getSnapshot(undefined, "files");
      const parsed = JSON.parse(result);

      const file = parsed.files[0];
      expect(file.path).toBeDefined();
      expect(file.language).toBeDefined();
    });
  });

  describe("Section: languages", () => {
    it("should return language statistics", async () => {
      const result = await getSnapshot(undefined, "languages");
      const parsed = JSON.parse(result);

      expect(parsed.languages).toBeDefined();
      expect(parsed.primaryLanguage).toBeDefined();
    });

    it("should include language details", async () => {
      const result = await getSnapshot(undefined, "languages");
      const parsed = JSON.parse(result);

      const lang = parsed.languages[0];
      expect(lang.name).toBeDefined();
      expect(lang.fileCount).toBeDefined();
      expect(lang.percentage).toBeDefined();
    });
  });

  describe("Section: entryPoints", () => {
    it("should return entry points", async () => {
      const result = await getSnapshot(undefined, "entryPoints");
      const parsed = JSON.parse(result);

      expect(parsed.entryPoints).toBeDefined();
      expect(Array.isArray(parsed.entryPoints)).toBe(true);
    });
  });

  describe("Section: configs", () => {
    it("should return config information", async () => {
      const result = await getSnapshot(undefined, "configs");
      const parsed = JSON.parse(result);

      expect(parsed.configs).toBeDefined();
      expect(parsed.configs.packageJson).toBeDefined();
    });
  });

  describe("Section: directories", () => {
    it("should return directory structure", async () => {
      const result = await getSnapshot(undefined, "directories");
      const parsed = JSON.parse(result);

      expect(parsed.directories).toBeDefined();
      expect(Array.isArray(parsed.directories)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return error when no repo analyzed", async () => {
      // Create new cache and test without analysis
      repoCache.clear();

      const result = await getSnapshot();
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("analyze_repo");

      // Re-analyze for other tests
      await analyzeRepo(testRepoPath);
    });
  });
});
