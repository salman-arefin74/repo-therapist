import * as fs from "fs";
import * as path from "path";
import { simpleGit } from "simple-git";

/**
 * Test fixture utilities
 * Creates temporary repo structures for testing
 */

export const TEST_FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures", "repos");

export interface TestRepoOptions {
  name: string;
  files?: Record<string, string>;
  withGit?: boolean;
  commits?: { message: string; files: Record<string, string>; author?: string }[];
}

/**
 * Create a temporary test repository
 */
export async function createTestRepo(options: TestRepoOptions): Promise<string> {
  const repoPath = path.join(TEST_FIXTURES_DIR, options.name);

  // Clean up if exists
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true });
  }

  // Create directory
  fs.mkdirSync(repoPath, { recursive: true });

  // Create initial files
  if (options.files) {
    for (const [filePath, content] of Object.entries(options.files)) {
      const fullPath = path.join(repoPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  }

  // Initialize git if requested
  if (options.withGit || options.commits) {
    const git = simpleGit(repoPath);
    await git.init();
    await git.addConfig("user.email", "test@test.com");
    await git.addConfig("user.name", "Test User");

    // Add initial files and commit
    if (options.files && Object.keys(options.files).length > 0) {
      await git.add(".");
      await git.commit("Initial commit");
    }

    // Create additional commits
    if (options.commits) {
      for (const commit of options.commits) {
        for (const [filePath, content] of Object.entries(commit.files)) {
          const fullPath = path.join(repoPath, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content);
        }
        await git.add(".");

        if (commit.author) {
          await git.addConfig("user.name", commit.author);
        }
        await git.commit(commit.message);
        if (commit.author) {
          await git.addConfig("user.name", "Test User");
        }
      }
    }
  }

  return repoPath;
}

/**
 * Clean up test repository
 */
export function cleanupTestRepo(repoPath: string): void {
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true });
  }
}

/**
 * Clean up all test fixtures
 */
export function cleanupAllFixtures(): void {
  if (fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.rmSync(TEST_FIXTURES_DIR, { recursive: true });
  }
}

/**
 * Sample package.json content
 */
export const SAMPLE_PACKAGE_JSON = JSON.stringify(
  {
    name: "test-project",
    version: "1.0.0",
    description: "A test project",
    main: "src/index.js",
    type: "module",
    scripts: {
      start: "node src/index.js",
      test: "vitest",
      build: "tsc",
    },
    dependencies: {
      express: "^4.18.0",
      lodash: "^4.17.21",
    },
    devDependencies: {
      typescript: "^5.0.0",
      vitest: "^1.0.0",
    },
  },
  null,
  2
);

/**
 * Sample tsconfig.json content
 */
export const SAMPLE_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules"],
  },
  null,
  2
);

/**
 * Sample TypeScript file content
 */
export const SAMPLE_TS_FILE = `
import { Request, Response } from 'express';

export interface User {
  id: string;
  name: string;
  email: string;
}

export function getUser(id: string): User | null {
  // Implementation
  return null;
}

export async function createUser(data: Partial<User>): Promise<User> {
  // Implementation
  throw new Error('Not implemented');
}
`.trim();

/**
 * Sample JavaScript file content
 */
export const SAMPLE_JS_FILE = `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

module.exports = app;
`.trim();
