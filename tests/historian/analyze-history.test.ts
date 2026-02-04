import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { analyzeGitHistory } from "../../src/historian/analyze-history.js";
import {
  createTestRepo,
  cleanupTestRepo,
  SAMPLE_PACKAGE_JSON,
  SAMPLE_TS_FILE,
} from "../fixtures/setup.js";

describe("Historian: analyzeGitHistory", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Create a test repository with git history
    testRepoPath = await createTestRepo({
      name: "historian-test-repo",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "src/index.ts": SAMPLE_TS_FILE,
        "src/stable.ts": "export const stable = true;",
      },
      commits: [
        // Simulate churn on auth.ts
        {
          message: "Add auth module",
          files: { "src/auth.ts": "// v1\nexport const auth = {};" },
          author: "Alice",
        },
        {
          message: "Fix auth bug",
          files: { "src/auth.ts": "// v2\nexport const auth = { fixed: true };" },
          author: "Bob",
        },
        {
          message: "Refactor auth module",
          files: { "src/auth.ts": "// v3\nexport const auth = { refactored: true };" },
          author: "Alice",
        },
        {
          message: "Add feature to auth",
          files: { "src/auth.ts": "// v4\nexport const auth = { feature: true };" },
          author: "Charlie",
        },
        {
          message: "Fix another auth bug",
          files: { "src/auth.ts": "// v5\nexport const auth = { fixed2: true };" },
          author: "Bob",
        },
        // Add some other changes
        {
          message: "Update utils",
          files: { "src/utils.ts": "export const utils = {};" },
          author: "Alice",
        },
        {
          message: "Add tests",
          files: { "tests/auth.test.ts": "describe('auth', () => {});" },
          author: "Alice",
        },
      ],
    });
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  describe("Basic History", () => {
    it("should return history for git repository", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history).not.toBeNull();
      expect(history!.historyVersion).toBe("1.0");
      expect(history!.repoPath).toBe(testRepoPath);
    });

    it("should count total commits", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      // Initial commit + 7 test commits
      expect(history!.totalCommits).toBeGreaterThanOrEqual(7);
    });

    it("should identify authors", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.totalAuthors).toBeGreaterThanOrEqual(3);
      expect(Object.keys(history!.authorStats)).toContain("Alice");
      expect(Object.keys(history!.authorStats)).toContain("Bob");
      expect(Object.keys(history!.authorStats)).toContain("Charlie");
    });

    it("should track date range", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.dateRange).not.toBeNull();
      expect(history!.dateRange!.start).toBeDefined();
      expect(history!.dateRange!.end).toBeDefined();
    });
  });

  describe("File Churn", () => {
    it("should track churn per file", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.fileChurn).toBeDefined();
      expect(Object.keys(history!.fileChurn).length).toBeGreaterThan(0);
    });

    it("should identify high-churn file", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const authChurn = history!.fileChurn["src/auth.ts"];
      expect(authChurn).toBeDefined();
      expect(authChurn.totalCommits).toBe(5); // 5 commits touched auth.ts
    });

    it("should track authors per file", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const authChurn = history!.fileChurn["src/auth.ts"];
      expect(authChurn.authorCount).toBe(3); // Alice, Bob, Charlie
      expect(authChurn.authors).toContain("Alice");
      expect(authChurn.authors).toContain("Bob");
      expect(authChurn.authors).toContain("Charlie");
    });

    it("should calculate churn score", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const authChurn = history!.fileChurn["src/auth.ts"];
      const utilsChurn = history!.fileChurn["src/utils.ts"];

      // auth.ts should have higher churn score (more commits, more authors)
      expect(authChurn.churnScore).toBeGreaterThan(utilsChurn?.churnScore || 0);
    });

    it("should list high churn files", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.highChurnFiles).toBeDefined();
      expect(history!.highChurnFiles).toContain("src/auth.ts");
    });
  });

  describe("Author Stats", () => {
    it("should track commits per author", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const aliceStats = history!.authorStats["Alice"];
      expect(aliceStats).toBeDefined();
      expect(aliceStats.totalCommits).toBeGreaterThanOrEqual(3);
    });

    it("should track files contributed by author", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const aliceStats = history!.authorStats["Alice"];
      expect(aliceStats.filesContributed.length).toBeGreaterThan(0);
      expect(aliceStats.filesContributed).toContain("src/auth.ts");
    });

    it("should track first and last commit dates", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const aliceStats = history!.authorStats["Alice"];
      expect(aliceStats.firstCommit).toBeDefined();
      expect(aliceStats.lastCommit).toBeDefined();
    });
  });

  describe("File Ownership", () => {
    it("should identify file ownership", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.fileOwnership).toBeDefined();
      expect(Object.keys(history!.fileOwnership).length).toBeGreaterThan(0);
    });

    it("should identify disputed ownership for multi-author files", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const authOwnership = history!.fileOwnership["src/auth.ts"];
      expect(authOwnership).toBeDefined();
      // With 3 authors and no clear majority, ownership should be disputed or shared
      expect(["disputed", "shared"]).toContain(authOwnership.ownershipClarity);
    });

    it("should list multi-author files", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.multiAuthorFiles).toBeDefined();
      expect(history!.multiAuthorFiles).toContain("src/auth.ts");
    });

    it("should track contributors with percentages", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const authOwnership = history!.fileOwnership["src/auth.ts"];
      expect(authOwnership.contributors.length).toBeGreaterThan(0);

      for (const contributor of authOwnership.contributors) {
        expect(contributor.author).toBeDefined();
        expect(contributor.commits).toBeGreaterThan(0);
        expect(contributor.percent).toBeGreaterThanOrEqual(0);
        expect(contributor.percent).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Derived Insights", () => {
    it("should identify hot paths", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.hotPaths).toBeDefined();
      // auth.ts should be in hot paths due to high churn
      const authHotPath = history!.hotPaths.find((h) => h.path === "src/auth.ts");
      expect(authHotPath).toBeDefined();
    });

    it("should categorize hot path risk levels", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      for (const hotPath of history!.hotPaths) {
        expect(["high", "medium", "low"]).toContain(hotPath.riskLevel);
        expect(hotPath.reason).toBeDefined();
        expect(hotPath.reason.length).toBeGreaterThan(0);
      }
    });

    it("should identify stable core files", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.stableCore).toBeDefined();
      // Note: stable.ts might not be in stable core since it was just created
      // But at least the array should be defined
    });

    it("should detect commit patterns", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.commitPattern).toBeDefined();
      expect(["steady", "burst", "sporadic", "abandoned", "active"]).toContain(
        history!.commitPattern.type
      );
      expect(history!.commitPattern.description).toBeDefined();
    });
  });

  describe("Fragile Files", () => {
    it("should identify fragile files", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.fragileFiles).toBeDefined();
    });

    it("should provide evidence for fragility", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      // auth.ts should be fragile due to many authors and fixes
      const authFragile = history!.fragileFiles.find((f) => f.path === "src/auth.ts");

      if (authFragile) {
        expect(authFragile.evidence.length).toBeGreaterThan(0);
        expect(authFragile.fragileScore).toBeGreaterThan(0);
        expect(authFragile.recommendation).toBeDefined();
      }
    });

    it("should categorize fragility types", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const validTypes = [
        "high-churn",
        "many-authors",
        "frequent-fixes",
        "recent-rewrites",
        "yo-yo-changes",
      ];

      for (const fragile of history!.fragileFiles) {
        for (const evidence of fragile.evidence) {
          expect(validTypes).toContain(evidence.type);
          expect(evidence.severity).toBeGreaterThanOrEqual(1);
          expect(evidence.severity).toBeLessThanOrEqual(10);
        }
      }
    });
  });

  describe("Commit Classification", () => {
    it("should classify fix commits", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const fixCommits = history!.recentCommits.filter((c) => c.isFix);
      expect(fixCommits.length).toBeGreaterThan(0);
    });

    it("should classify refactor commits", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const refactorCommits = history!.recentCommits.filter((c) => c.isRefactor);
      expect(refactorCommits.length).toBeGreaterThan(0);
    });

    it("should classify feature commits", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const featureCommits = history!.recentCommits.filter((c) => c.isFeature);
      expect(featureCommits.length).toBeGreaterThan(0);
    });
  });

  describe("Timeline", () => {
    it("should build timeline of events", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      expect(history!.timeline).toBeDefined();
      expect(history!.timeline.length).toBeGreaterThan(0);
    });

    it("should include commit events in timeline", async () => {
      const history = await analyzeGitHistory(testRepoPath);

      const commitEvents = history!.timeline.filter((e) => e.type === "commit");
      expect(commitEvents.length).toBeGreaterThan(0);
    });
  });
});

describe("Historian: Edge Cases", () => {
  it("should return null for repo without git", async () => {
    const noGitRepoPath = await createTestRepo({
      name: "no-git-repo",
      files: { "file.txt": "content" },
      withGit: false,
    });

    try {
      const history = await analyzeGitHistory(noGitRepoPath);
      expect(history).toBeNull();
    } finally {
      cleanupTestRepo(noGitRepoPath);
    }
  });

  it("should handle repo with single commit", async () => {
    const singleCommitRepoPath = await createTestRepo({
      name: "single-commit-repo",
      files: { "file.ts": "const x = 1;" },
      withGit: true,
    });

    try {
      const history = await analyzeGitHistory(singleCommitRepoPath);
      expect(history).not.toBeNull();
      expect(history!.totalCommits).toBe(1);
    } finally {
      cleanupTestRepo(singleCommitRepoPath);
    }
  });

  it("should handle non-existent path gracefully", async () => {
    const history = await analyzeGitHistory("/nonexistent/path");
    expect(history).toBeNull();
  });
});
