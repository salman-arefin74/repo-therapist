import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { simpleGit, SimpleGit } from "simple-git";
import {
  RepoAnalysis,
  FileInfo,
  DependencyInfo,
  StructureInfo,
  CodeMetrics,
  GitMetrics,
  RiskFactor,
} from "../types.js";
import { repoCache } from "../index.js";
import { scanRepo } from "../scanner/index.js";

/**
 * Analyze a repository's structure, dependencies, and git history
 */
export async function analyzeRepo(
  repoPath: string
): Promise<{ success: boolean; message: string; summary?: string; snapshot?: object }> {
  // Validate path
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const stats = fs.statSync(repoPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${repoPath}`);
  }

  const repoName = path.basename(repoPath);
  console.error(`Analyzing repository: ${repoName} at ${repoPath}`);

  // Step 1: Create static snapshot (ground truth)
  console.error(`[Step 1] Creating static snapshot...`);
  const snapshot = await scanRepo(repoPath);

  // Step 2: Gather additional analysis data
  console.error(`[Step 2] Analyzing structure and git history...`);
  const structure = await analyzeStructure(repoPath);
  const codeMetrics = await analyzeCode(repoPath);
  const gitMetrics = await analyzeGit(repoPath);
  const dependencies = await analyzeDependencies(repoPath);
  const techStack = detectTechStack(structure, dependencies);
  const risks = identifyRisks(codeMetrics, gitMetrics, structure);

  const analysis: RepoAnalysis = {
    path: repoPath,
    name: repoName,
    analyzedAt: new Date().toISOString(),
    structure,
    codeMetrics,
    gitMetrics,
    dependencies,
    risks,
    techStack,
  };

  // Cache both analysis and snapshot
  repoCache.set(repoPath, analysis, snapshot);

  return {
    success: true,
    message: `Successfully analyzed ${repoName}`,
    summary: generateQuickSummary(analysis),
    snapshot: {
      snapshotVersion: snapshot.snapshotVersion,
      totalFiles: snapshot.totalFiles,
      totalLines: snapshot.totalLines,
      primaryLanguage: snapshot.primaryLanguage,
      languages: snapshot.languages.slice(0, 5),
      entryPoints: snapshot.entryPoints,
      directories: snapshot.directories.slice(0, 10),
      configs: {
        hasPackageJson: !!snapshot.configs.packageJson,
        hasTsConfig: !!snapshot.configs.tsConfig,
        hasDockerfile: !!snapshot.configs.dockerfile,
        ciPlatforms: snapshot.configs.ci.map(c => c.platform),
      },
    },
  };
}

async function analyzeStructure(repoPath: string): Promise<StructureInfo> {
  const entries = fs.readdirSync(repoPath, { withFileTypes: true });

  const topLevelDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  const topLevelFiles = entries.filter((e) => e.isFile()).map((e) => e.name);

  const configFiles = topLevelFiles.filter(
    (f) =>
      f.endsWith(".json") ||
      f.endsWith(".yaml") ||
      f.endsWith(".yml") ||
      f.endsWith(".config.js") ||
      f.endsWith(".config.ts") ||
      f.startsWith(".")
  );

  // Detect entry points
  const entryPoints: string[] = [];
  const commonEntries = [
    "src/index.ts",
    "src/index.js",
    "src/main.ts",
    "src/main.js",
    "index.ts",
    "index.js",
    "app.ts",
    "app.js",
    "src/app.ts",
    "src/app.js",
  ];

  for (const entry of commonEntries) {
    if (fs.existsSync(path.join(repoPath, entry))) {
      entryPoints.push(entry);
    }
  }

  return {
    hasReadme: topLevelFiles.some((f) => f.toLowerCase().startsWith("readme")),
    hasPackageJson: topLevelFiles.includes("package.json"),
    hasTsConfig: topLevelFiles.includes("tsconfig.json"),
    hasGitIgnore: fs.existsSync(path.join(repoPath, ".gitignore")),
    topLevelDirs,
    configFiles,
    entryPoints,
  };
}

async function analyzeCode(repoPath: string): Promise<CodeMetrics> {
  // Find all source files (excluding node_modules, dist, etc.)
  const files = await glob("**/*", {
    cwd: repoPath,
    nodir: true,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/*.lock",
      "**/package-lock.json",
    ],
  });

  const fileInfos: FileInfo[] = [];
  const filesByExtension: Record<string, number> = {};
  let totalLines = 0;

  for (const file of files) {
    const fullPath = path.join(repoPath, file);
    try {
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) continue;

      const ext = path.extname(file) || "no-extension";
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;

      // Count lines for text files
      let lineCount = 0;
      if (isTextFile(ext)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        lineCount = content.split("\n").length;
        totalLines += lineCount;
      }

      fileInfos.push({
        path: file,
        size: stats.size,
        extension: ext,
        lineCount,
      });
    } catch {
      // Skip files we can't read
    }
  }

  // Sort by size to find largest files
  const largestFiles = [...fileInfos]
    .filter((f) => isTextFile(f.extension))
    .sort((a, b) => b.lineCount - a.lineCount)
    .slice(0, 10);

  return {
    totalFiles: fileInfos.length,
    totalLines,
    filesByExtension,
    largestFiles,
    averageFileSize:
      fileInfos.length > 0
        ? Math.round(
            fileInfos.reduce((sum, f) => sum + f.size, 0) / fileInfos.length
          )
        : 0,
  };
}

async function analyzeGit(repoPath: string): Promise<GitMetrics | null> {
  const gitDir = path.join(repoPath, ".git");
  if (!fs.existsSync(gitDir)) {
    return null;
  }

  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get recent commits
    const log = await git.log({ maxCount: 50 });
    const recentCommits = log.all.slice(0, 10).map((commit) => ({
      hash: commit.hash.substring(0, 7),
      date: commit.date,
      message: commit.message.split("\n")[0],
      author: commit.author_name,
      filesChanged: 0, // Would need separate call to get this
    }));

    // Get unique contributors
    const contributors: string[] = [...new Set(log.all.map((c) => c.author_name))];

    // Get most changed files (using git log --name-only)
    const fileChangeCounts: Record<string, number> = {};
    for (const commit of log.all.slice(0, 50)) {
      try {
        const diff = await git.diff([`${commit.hash}^`, commit.hash, "--name-only"]);
        const files = diff.split("\n").filter(Boolean);
        for (const file of files) {
          fileChangeCounts[file] = (fileChangeCounts[file] || 0) + 1;
        }
      } catch {
        // Skip if we can't get diff (e.g., initial commit)
      }
    }

    const mostChangedFiles = Object.entries(fileChangeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([filePath, changes]) => ({ path: filePath, changes }));

    return {
      totalCommits: log.total,
      recentCommits,
      contributors,
      mostChangedFiles,
      firstCommitDate: log.all.length > 0 ? log.all[log.all.length - 1].date : null,
      lastCommitDate: log.all.length > 0 ? log.all[0].date : null,
    };
  } catch (error) {
    console.error("Error analyzing git history:", error);
    return null;
  }
}

async function analyzeDependencies(repoPath: string): Promise<DependencyInfo[]> {
  const packageJsonPath = path.join(repoPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const deps: DependencyInfo[] = [];

    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        deps.push({ name, version: version as string, type: "production" });
      }
    }

    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        deps.push({ name, version: version as string, type: "development" });
      }
    }

    return deps;
  } catch {
    return [];
  }
}

function detectTechStack(
  structure: StructureInfo,
  dependencies: DependencyInfo[]
): string[] {
  const stack: string[] = [];
  const depNames = dependencies.map((d) => d.name);

  // Language/Runtime
  if (structure.hasTsConfig) stack.push("TypeScript");
  if (structure.hasPackageJson) stack.push("Node.js");

  // Frameworks
  if (depNames.includes("react")) stack.push("React");
  if (depNames.includes("vue")) stack.push("Vue");
  if (depNames.includes("angular")) stack.push("Angular");
  if (depNames.includes("express")) stack.push("Express");
  if (depNames.includes("fastify")) stack.push("Fastify");
  if (depNames.includes("next")) stack.push("Next.js");
  if (depNames.includes("nest")) stack.push("NestJS");

  // Testing
  if (depNames.includes("jest")) stack.push("Jest");
  if (depNames.includes("vitest")) stack.push("Vitest");
  if (depNames.includes("mocha")) stack.push("Mocha");

  // Build tools
  if (depNames.includes("webpack")) stack.push("Webpack");
  if (depNames.includes("vite")) stack.push("Vite");
  if (depNames.includes("esbuild")) stack.push("esbuild");

  // Database
  if (depNames.includes("prisma")) stack.push("Prisma");
  if (depNames.includes("mongoose")) stack.push("MongoDB");
  if (depNames.includes("pg")) stack.push("PostgreSQL");

  return stack;
}

function identifyRisks(
  codeMetrics: CodeMetrics,
  gitMetrics: GitMetrics | null,
  structure: StructureInfo
): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Large files
  for (const file of codeMetrics.largestFiles) {
    if (file.lineCount > 500) {
      risks.push({
        type: "size",
        severity: file.lineCount > 1000 ? "high" : "medium",
        file: file.path,
        description: `Large file with ${file.lineCount} lines`,
        recommendation: "Consider breaking this file into smaller modules",
      });
    }
  }

  // High churn files
  if (gitMetrics) {
    for (const file of gitMetrics.mostChangedFiles.slice(0, 5)) {
      if (file.changes > 10) {
        risks.push({
          type: "churn",
          severity: file.changes > 20 ? "high" : "medium",
          file: file.path,
          description: `High churn: changed ${file.changes} times in recent history`,
          recommendation:
            "Frequently changed files may indicate instability or unclear requirements",
        });
      }
    }
  }

  // Missing documentation
  if (!structure.hasReadme) {
    risks.push({
      type: "structure",
      severity: "medium",
      description: "No README file found",
      recommendation: "Add a README to help others understand this project",
    });
  }

  // No entry points found
  if (structure.entryPoints.length === 0) {
    risks.push({
      type: "structure",
      severity: "low",
      description: "No clear entry point detected",
      recommendation: "Consider adding a clear entry point (e.g., src/index.ts)",
    });
  }

  return risks;
}

function isTextFile(ext: string): boolean {
  const textExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".txt",
    ".yaml",
    ".yml",
    ".css",
    ".scss",
    ".html",
    ".vue",
    ".svelte",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".rb",
    ".php",
    ".sh",
    ".sql",
  ];
  return textExtensions.includes(ext.toLowerCase());
}

function generateQuickSummary(analysis: RepoAnalysis): string {
  const lines: string[] = [
    `📁 ${analysis.name}`,
    ``,
    `Tech Stack: ${analysis.techStack.join(", ") || "Unknown"}`,
    `Files: ${analysis.codeMetrics.totalFiles} | Lines: ${analysis.codeMetrics.totalLines.toLocaleString()}`,
  ];

  if (analysis.gitMetrics) {
    lines.push(
      `Commits: ${analysis.gitMetrics.totalCommits} | Contributors: ${analysis.gitMetrics.contributors.length}`
    );
  }

  if (analysis.risks.length > 0) {
    const highRisks = analysis.risks.filter((r) => r.severity === "high").length;
    const medRisks = analysis.risks.filter((r) => r.severity === "medium").length;
    lines.push(`Risks: ${highRisks} high, ${medRisks} medium`);
  }

  return lines.join("\n");
}
