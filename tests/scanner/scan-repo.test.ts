import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { scanRepo } from "../../src/scanner/scan-repo.js";
import {
  createTestRepo,
  cleanupTestRepo,
  SAMPLE_PACKAGE_JSON,
  SAMPLE_TSCONFIG,
  SAMPLE_TS_FILE,
  SAMPLE_JS_FILE,
} from "../fixtures/setup.js";

describe("Scanner: scanRepo", () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Create a test repository with various files
    testRepoPath = await createTestRepo({
      name: "scanner-test-repo",
      files: {
        "package.json": SAMPLE_PACKAGE_JSON,
        "tsconfig.json": SAMPLE_TSCONFIG,
        "src/index.ts": SAMPLE_TS_FILE,
        "src/utils/helpers.ts": "export const helper = () => true;",
        "src/utils/format.js": SAMPLE_JS_FILE,
        "tests/index.test.ts": "describe('test', () => { it('works', () => {}) });",
        "README.md": "# Test Project\n\nThis is a test.",
        ".gitignore": "node_modules\ndist\n.env",
        ".env.example": "API_KEY=xxx",
      },
      withGit: true,
    });
  });

  afterAll(() => {
    cleanupTestRepo(testRepoPath);
  });

  describe("Basic Snapshot", () => {
    it("should create a snapshot with correct metadata", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.snapshotVersion).toBe("1.0");
      expect(snapshot.repoName).toBe("scanner-test-repo");
      expect(snapshot.repoPath).toBe(testRepoPath);
      expect(snapshot.createdAt).toBeDefined();
    });

    it("should count files correctly", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.totalFiles).toBeGreaterThan(0);
      expect(snapshot.files.length).toBe(snapshot.totalFiles);
    });

    it("should calculate total lines", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.totalLines).toBeGreaterThan(0);
    });
  });

  describe("Language Detection", () => {
    it("should detect TypeScript as a language", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const tsLang = snapshot.languages.find((l) => l.name === "TypeScript");
      expect(tsLang).toBeDefined();
      expect(tsLang!.fileCount).toBeGreaterThan(0);
    });

    it("should detect JavaScript as a language", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const jsLang = snapshot.languages.find((l) => l.name === "JavaScript");
      expect(jsLang).toBeDefined();
    });

    it("should identify primary language", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.primaryLanguage).toBeDefined();
      // Primary language should be one of the detected languages
      const langNames = snapshot.languages.map((l) => l.name);
      expect(langNames).toContain(snapshot.primaryLanguage);
    });

    it("should calculate language percentages", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const total = snapshot.languages.reduce((sum, l) => sum + l.percentage, 0);
      // Should be close to 100% (might not be exact due to rounding)
      expect(total).toBeGreaterThan(90);
      expect(total).toBeLessThanOrEqual(100);
    });
  });

  describe("File Classification", () => {
    it("should identify config files", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const configFiles = snapshot.files.filter((f) => f.isConfig);
      const configNames = configFiles.map((f) => f.name);

      expect(configNames).toContain("package.json");
      expect(configNames).toContain("tsconfig.json");
    });

    it("should identify test files", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const testFiles = snapshot.files.filter((f) => f.isTest);
      expect(testFiles.length).toBeGreaterThan(0);
      expect(testFiles.some((f) => f.relativePath.includes("test"))).toBe(true);
    });

    it("should track file extensions", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const extensions = snapshot.files.map((f) => f.extension);
      expect(extensions).toContain(".ts");
      expect(extensions).toContain(".json");
      expect(extensions).toContain(".md");
    });
  });

  describe("Entry Points", () => {
    it("should detect entry points from package.json main", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const mainEntry = snapshot.entryPoints.find((e) => e.type === "main");
      expect(mainEntry).toBeDefined();
      expect(mainEntry!.source).toContain("package.json");
    });

    it("should include confidence levels", async () => {
      const snapshot = await scanRepo(testRepoPath);

      for (const entry of snapshot.entryPoints) {
        expect(["high", "medium", "low"]).toContain(entry.confidence);
      }
    });

    it("should cite source for each entry point", async () => {
      const snapshot = await scanRepo(testRepoPath);

      for (const entry of snapshot.entryPoints) {
        expect(entry.source).toBeDefined();
        expect(entry.source.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Config Parsing", () => {
    it("should parse package.json", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.packageJson).not.toBeNull();
      expect(snapshot.configs.packageJson!.name).toBe("test-project");
      expect(snapshot.configs.packageJson!.version).toBe("1.0.0");
    });

    it("should extract dependencies from package.json", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.packageJson!.dependencies).toHaveProperty("express");
      expect(snapshot.configs.packageJson!.devDependencies).toHaveProperty("typescript");
    });

    it("should extract scripts from package.json", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.packageJson!.scripts).toHaveProperty("start");
      expect(snapshot.configs.packageJson!.scripts).toHaveProperty("test");
    });

    it("should parse tsconfig.json", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.tsConfig).not.toBeNull();
      expect(snapshot.configs.tsConfig!.compilerOptions.strict).toBe(true);
      expect(snapshot.configs.tsConfig!.compilerOptions.target).toBe("ES2022");
    });

    it("should parse .gitignore patterns", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.gitignore).not.toBeNull();
      expect(snapshot.configs.gitignore).toContain("node_modules");
      expect(snapshot.configs.gitignore).toContain("dist");
    });

    it("should detect .env.example", async () => {
      const snapshot = await scanRepo(testRepoPath);

      expect(snapshot.configs.envExample).toBe(".env.example");
    });
  });

  describe("Directory Analysis", () => {
    it("should identify top-level directories", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const dirNames = snapshot.directories.map((d) => d.path);
      expect(dirNames).toContain("src");
      expect(dirNames).toContain("tests");
    });

    it("should count files per directory", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const srcDir = snapshot.directories.find((d) => d.path === "src");
      expect(srcDir).toBeDefined();
      expect(srcDir!.fileCount).toBeGreaterThan(0);
    });

    it("should infer directory purposes", async () => {
      const snapshot = await scanRepo(testRepoPath);

      const srcDir = snapshot.directories.find((d) => d.path === "src");
      const testsDir = snapshot.directories.find((d) => d.path === "tests");

      expect(srcDir?.purpose).toBe("source code");
      expect(testsDir?.purpose).toBe("tests");
    });
  });

  describe("Error Handling", () => {
    it("should throw for non-existent path", async () => {
      await expect(scanRepo("/nonexistent/path")).rejects.toThrow();
    });
  });
});

describe("Scanner: Edge Cases", () => {
  it("should handle empty repository", async () => {
    const emptyRepoPath = await createTestRepo({
      name: "empty-repo",
      files: {},
      withGit: true,
    });

    try {
      const snapshot = await scanRepo(emptyRepoPath);
      expect(snapshot.totalFiles).toBe(0);
      expect(snapshot.languages).toHaveLength(0);
    } finally {
      cleanupTestRepo(emptyRepoPath);
    }
  });

  it("should handle repo without package.json", async () => {
    const noPackageRepoPath = await createTestRepo({
      name: "no-package-repo",
      files: {
        "main.py": "print('hello')",
        "README.md": "# Python Project",
      },
    });

    try {
      const snapshot = await scanRepo(noPackageRepoPath);
      expect(snapshot.configs.packageJson).toBeNull();
      expect(snapshot.primaryLanguage).toBe("Python");
    } finally {
      cleanupTestRepo(noPackageRepoPath);
    }
  });
});
