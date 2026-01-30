export interface FileInfo {
  path: string;
  size: number;
  extension: string;
  lineCount: number;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  filesChanged: number;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: "production" | "development";
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  largestFiles: FileInfo[];
  averageFileSize: number;
}

export interface GitMetrics {
  totalCommits: number;
  recentCommits: GitCommit[];
  contributors: string[];
  mostChangedFiles: { path: string; changes: number }[];
  firstCommitDate: string | null;
  lastCommitDate: string | null;
}

export interface StructureInfo {
  hasReadme: boolean;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasGitIgnore: boolean;
  topLevelDirs: string[];
  configFiles: string[];
  entryPoints: string[];
}

export interface RiskFactor {
  type: "complexity" | "size" | "churn" | "dependency" | "structure";
  severity: "low" | "medium" | "high";
  file?: string;
  description: string;
  recommendation: string;
}

export interface RepoAnalysis {
  path: string;
  name: string;
  analyzedAt: string;
  structure: StructureInfo;
  codeMetrics: CodeMetrics;
  gitMetrics: GitMetrics | null;
  dependencies: DependencyInfo[];
  risks: RiskFactor[];
  techStack: string[];
}
