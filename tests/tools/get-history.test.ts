import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getHistory, whyIsThisWeird } from "../../src/tools/get-history.js";
import { analyzeRepo } from "../../src/tools/analyze-repo.js";
import { repoCache } from "../../src/index.js";
import {
  createTestRepo,
  cleanupTestRepo,
  SAMPLE_PACKAGE_JSON,
} from "../fixtures/setup.js";

describe("Tool: getHistory", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = await createTestRepo({
      name: "history-tool-test-repo",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "src/index.ts": "export const main = () => {};",
      },
      commits: [
        {
          message: "Add auth module",
          files: { "src/auth.ts": "// v1" },
          author: "Alice",
        },
        {
          message: "Fix auth bug",
          files: { "src/auth.ts": "// v2 - fixed" },
          author: "Bob",
        },
        {
          message: "Refactor auth",
          files: { "src/auth.ts": "// v3 - refactored" },
          author: "Charlie",
        },
        {
          message: "Add utils",
          files: { "src/utils.ts": "export const utils = {};" },
          author: "Alice",
        },
      ],
    });

    await analyzeRepo(testRepoPath);
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  describe("Section: all", () => {
    it("should return summary by default", async () => {
      const result = await getHistory();
      const parsed = JSON.parse(result);

      expect(parsed._citation).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.insights).toBeDefined();
    });

    it("should include high-level metrics", async () => {
      const result = await getHistory();
      const parsed = JSON.parse(result);

      expect(parsed.summary.totalCommits).toBeGreaterThan(0);
      expect(parsed.summary.totalAuthors).toBeGreaterThan(0);
    });
  });

  describe("Section: churn", () => {
    it("should return file churn data", async () => {
      const result = await getHistory(undefined, "churn");
      const parsed = JSON.parse(result);

      expect(parsed.fileChurn).toBeDefined();
      expect(parsed.highChurnFiles).toBeDefined();
    });

    it("should include churn metrics per file", async () => {
      const result = await getHistory(undefined, "churn");
      const parsed = JSON.parse(result);

      const files = Object.keys(parsed.fileChurn);
      if (files.length > 0) {
        const churn = parsed.fileChurn[files[0]];
        expect(churn.totalCommits).toBeDefined();
        expect(churn.churnScore).toBeDefined();
        expect(churn.authors).toBeDefined();
      }
    });
  });

  describe("Section: authors", () => {
    it("should return author statistics", async () => {
      const result = await getHistory(undefined, "authors");
      const parsed = JSON.parse(result);

      expect(parsed.totalAuthors).toBeGreaterThan(0);
      expect(parsed.authors).toBeDefined();
    });

    it("should include author details", async () => {
      const result = await getHistory(undefined, "authors");
      const parsed = JSON.parse(result);

      const authors = Object.keys(parsed.authors);
      expect(authors.length).toBeGreaterThan(0);

      const author = parsed.authors[authors[0]];
      expect(author.totalCommits).toBeDefined();
      expect(author.filesContributedCount).toBeDefined();
    });
  });

  describe("Section: fragile", () => {
    it("should return fragile files", async () => {
      const result = await getHistory(undefined, "fragile");
      const parsed = JSON.parse(result);

      expect(parsed.fragileFiles).toBeDefined();
      expect(parsed.recentlyFragile).toBeDefined();
    });
  });

  describe("Section: hotPaths", () => {
    it("should return hot paths and stable core", async () => {
      const result = await getHistory(undefined, "hotPaths");
      const parsed = JSON.parse(result);

      expect(parsed.hotPaths).toBeDefined();
      expect(parsed.stableCore).toBeDefined();
    });
  });

  describe("Section: timeline", () => {
    it("should return commit timeline", async () => {
      const result = await getHistory(undefined, "timeline");
      const parsed = JSON.parse(result);

      expect(parsed.commitPattern).toBeDefined();
      expect(parsed.recentCommits).toBeDefined();
      expect(parsed.timeline).toBeDefined();
    });

    it("should include commit details", async () => {
      const result = await getHistory(undefined, "timeline");
      const parsed = JSON.parse(result);

      if (parsed.recentCommits.length > 0) {
        const commit = parsed.recentCommits[0];
        expect(commit.hash).toBeDefined();
        expect(commit.message).toBeDefined();
        expect(commit.author).toBeDefined();
      }
    });
  });

  describe("Section: ownership", () => {
    it("should return file ownership", async () => {
      const result = await getHistory(undefined, "ownership");
      const parsed = JSON.parse(result);

      expect(parsed.ownership).toBeDefined();
      expect(parsed.multiAuthorFiles).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should return error when no repo analyzed", async () => {
      repoCache.clear();

      const result = await getHistory();
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();

      // Re-analyze
      await analyzeRepo(testRepoPath);
    });
  });
});

describe("Tool: whyIsThisWeird", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = await createTestRepo({
      name: "weird-file-test-repo",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
      },
      commits: [
        { message: "Add auth", files: { "src/auth.ts": "// v1" }, author: "Alice" },
        { message: "Fix auth", files: { "src/auth.ts": "// v2" }, author: "Bob" },
        { message: "Fix auth again", files: { "src/auth.ts": "// v3" }, author: "Charlie" },
        { message: "Refactor auth", files: { "src/auth.ts": "// v4" }, author: "Dave" },
        { message: "Another fix", files: { "src/auth.ts": "// v5" }, author: "Eve" },
        { message: "Add stable file", files: { "src/stable.ts": "// stable" }, author: "Alice" },
      ],
    });

    await analyzeRepo(testRepoPath);
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  it("should explain why a file is weird", async () => {
    const result = await whyIsThisWeird("src/auth.ts");

    expect(result).toContain("src/auth.ts");
    expect(result).toContain("Change History");
    expect(result).toContain("Total commits");
  });

  it("should identify high churn files", async () => {
    const result = await whyIsThisWeird("src/auth.ts");

    // Should mention the file has been changed multiple times
    expect(result).toMatch(/\d+ commit/i);
  });

  it("should identify multiple authors", async () => {
    const result = await whyIsThisWeird("src/auth.ts");

    // Should mention multiple authors
    expect(result).toMatch(/authors|people/i);
  });

  it("should return message for unknown file", async () => {
    const result = await whyIsThisWeird("nonexistent/file.ts");

    expect(result).toContain("No history found");
  });

  it("should return message when no history available", async () => {
    repoCache.clear();

    const result = await whyIsThisWeird("src/auth.ts");
    expect(result).toContain("no git history");

    // Re-analyze
    await analyzeRepo(testRepoPath);
  });
});
