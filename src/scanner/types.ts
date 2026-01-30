/**
 * Static snapshot of a repository - the ground truth
 * LLMs must cite this structure, not guess
 */

export interface FileEntry {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  lineCount: number | null; // null for binary files
  language: string | null;
  isConfig: boolean;
  isTest: boolean;
  isGenerated: boolean;
}

export interface LanguageStats {
  name: string;
  extensions: string[];
  fileCount: number;
  lineCount: number;
  percentage: number; // of total lines
}

export interface EntryPoint {
  path: string;
  type: "main" | "bin" | "export" | "script" | "server" | "cli";
  confidence: "high" | "medium" | "low";
  source: string; // where we found this (e.g., "package.json#main")
}

export interface PackageJsonConfig {
  name: string | null;
  version: string | null;
  description: string | null;
  main: string | null;
  bin: Record<string, string> | string | null;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  engines: Record<string, string> | null;
  type: "module" | "commonjs" | null;
}

export interface TsConfigInfo {
  path: string;
  compilerOptions: {
    target: string | null;
    module: string | null;
    outDir: string | null;
    rootDir: string | null;
    strict: boolean | null;
    jsx: string | null;
  };
  include: string[];
  exclude: string[];
  extends: string | null;
}

export interface DockerConfig {
  path: string;
  baseImage: string | null;
  exposedPorts: number[];
  hasMultiStage: boolean;
  stages: string[];
}

export interface CIConfig {
  platform: "github-actions" | "gitlab-ci" | "circleci" | "jenkins" | "travis" | "other";
  path: string;
  triggers: string[];
  jobs: string[];
}

export interface ConfigFiles {
  packageJson: PackageJsonConfig | null;
  tsConfig: TsConfigInfo | null;
  additionalTsConfigs: TsConfigInfo[];
  dockerfile: DockerConfig | null;
  dockerCompose: string | null; // path if exists
  ci: CIConfig[];
  eslint: string | null; // path
  prettier: string | null; // path
  gitignore: string[] | null; // parsed patterns
  envExample: string | null; // path to .env.example
  other: { name: string; path: string }[];
}

export interface RepoSnapshot {
  // Metadata
  snapshotVersion: "1.0";
  createdAt: string;
  repoPath: string;
  repoName: string;

  // File tree
  files: FileEntry[];
  totalFiles: number;
  totalLines: number;
  totalSize: number;

  // Languages
  languages: LanguageStats[];
  primaryLanguage: string | null;

  // Entry points
  entryPoints: EntryPoint[];

  // Configs
  configs: ConfigFiles;

  // Directory structure (top-level overview)
  directories: {
    path: string;
    fileCount: number;
    purpose: string | null; // inferred purpose like "tests", "source", "config"
  }[];
}
