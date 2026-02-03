/**
 * Git History Analysis - The Time Dimension
 * This is where we understand WHY code is the way it is
 */

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
  messageFirstLine: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
  isMerge: boolean;
  isRevert: boolean;
  isRefactor: boolean;
  isFix: boolean;
  isFeature: boolean;
}

export interface FileChurn {
  path: string;
  totalCommits: number;
  totalInsertions: number;
  totalDeletions: number;
  netChange: number;
  authors: string[];
  authorCount: number;
  firstCommit: string;
  lastCommit: string;
  daysSinceLastChange: number;
  commitsLast30Days: number;
  commitsLast90Days: number;
  churnScore: number; // Higher = more volatile
}

export interface AuthorStats {
  name: string;
  email: string;
  totalCommits: number;
  totalInsertions: number;
  totalDeletions: number;
  filesOwned: string[]; // Files they're primary author of
  filesContributed: string[]; // Files they've touched
  firstCommit: string;
  lastCommit: string;
  activeDays: number;
  averageCommitsPerDay: number;
}

export interface FileOwnership {
  path: string;
  primaryAuthor: string | null;
  primaryAuthorPercent: number;
  contributors: {
    author: string;
    commits: number;
    percent: number;
    lastCommit: string;
  }[];
  ownershipClarity: "clear" | "shared" | "disputed"; // How clear is ownership?
}

export interface HotPath {
  path: string;
  reason: string;
  churnScore: number;
  recentCommits: number;
  authorCount: number;
  riskLevel: "high" | "medium" | "low";
}

export interface FragileFile {
  path: string;
  reasons: string[];
  evidence: {
    type: "high-churn" | "many-authors" | "frequent-fixes" | "recent-rewrites" | "yo-yo-changes";
    detail: string;
    severity: number; // 1-10
  }[];
  fragileScore: number; // Composite score
  recommendation: string;
}

export interface TimelineEvent {
  date: string;
  type: "commit" | "burst" | "quiet-period" | "ownership-change" | "major-refactor";
  description: string;
  files?: string[];
  author?: string;
}

export interface CommitPattern {
  type: "steady" | "burst" | "sporadic" | "abandoned" | "active";
  description: string;
  averageCommitsPerWeek: number;
  longestGapDays: number;
  busiestPeriod: { start: string; end: string; commits: number } | null;
}

export interface GitHistory {
  // Metadata
  historyVersion: "1.0";
  analyzedAt: string;
  repoPath: string;

  // Raw data
  totalCommits: number;
  totalAuthors: number;
  firstCommit: CommitInfo | null;
  lastCommit: CommitInfo | null;
  dateRange: { start: string; end: string } | null;

  // Per-file analysis
  fileChurn: Record<string, FileChurn>;
  fileOwnership: Record<string, FileOwnership>;

  // Per-author analysis
  authorStats: Record<string, AuthorStats>;

  // Derived insights
  hotPaths: HotPath[];
  stableCore: string[]; // Files that rarely change
  fragileFiles: FragileFile[];
  commitPattern: CommitPattern;

  // Recent activity
  recentCommits: CommitInfo[]; // Last 50 commits
  timeline: TimelineEvent[]; // Key events

  // Quick lookup
  highChurnFiles: string[]; // Top 10 by churn
  multiAuthorFiles: string[]; // Files with 3+ authors
  recentlyFragile: string[]; // Files with issues in last 30 days
}
