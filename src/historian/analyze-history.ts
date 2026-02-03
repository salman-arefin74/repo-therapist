import * as fs from "fs";
import * as path from "path";
import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from "simple-git";
import {
  GitHistory,
  CommitInfo,
  FileChurn,
  AuthorStats,
  FileOwnership,
  HotPath,
  FragileFile,
  TimelineEvent,
  CommitPattern,
} from "./types.js";

/**
 * Analyze git history to understand the time dimension of a repository
 * This reveals WHY code is the way it is
 */
export async function analyzeGitHistory(repoPath: string): Promise<GitHistory | null> {
  const gitDir = path.join(repoPath, ".git");
  if (!fs.existsSync(gitDir)) {
    console.error("[Historian] No .git directory found");
    return null;
  }

  const git: SimpleGit = simpleGit(repoPath);

  console.error("[Historian] Analyzing git history...");

  try {
    // Get all commits (up to 1000 for performance)
    const log = await git.log({ maxCount: 1000, "--stat": null });
    
    if (log.total === 0) {
      console.error("[Historian] No commits found");
      return null;
    }

    console.error(`[Historian] Found ${log.total} commits`);

    // Process commits
    const commits = await processCommits(git, log);
    console.error(`[Historian] Processed ${commits.length} commits`);

    // Analyze file churn
    const fileChurn = analyzeFileChurn(commits);
    console.error(`[Historian] Analyzed churn for ${Object.keys(fileChurn).length} files`);

    // Analyze author stats
    const authorStats = analyzeAuthorStats(commits);
    console.error(`[Historian] Found ${Object.keys(authorStats).length} authors`);

    // Analyze file ownership
    const fileOwnership = analyzeFileOwnership(fileChurn, commits);

    // Derive insights
    const hotPaths = identifyHotPaths(fileChurn);
    const stableCore = identifyStableCore(fileChurn);
    const fragileFiles = identifyFragileFiles(fileChurn, fileOwnership, commits);
    const commitPattern = analyzeCommitPattern(commits);
    const timeline = buildTimeline(commits, fileChurn);

    // Quick lookups
    const highChurnFiles = Object.values(fileChurn)
      .sort((a, b) => b.churnScore - a.churnScore)
      .slice(0, 10)
      .map((f) => f.path);

    const multiAuthorFiles = Object.values(fileChurn)
      .filter((f) => f.authorCount >= 3)
      .map((f) => f.path);

    const recentlyFragile = fragileFiles
      .filter((f) => f.fragileScore > 5)
      .slice(0, 10)
      .map((f) => f.path);

    const history: GitHistory = {
      historyVersion: "1.0",
      analyzedAt: new Date().toISOString(),
      repoPath,

      totalCommits: commits.length,
      totalAuthors: Object.keys(authorStats).length,
      firstCommit: commits.length > 0 ? commits[commits.length - 1] : null,
      lastCommit: commits.length > 0 ? commits[0] : null,
      dateRange:
        commits.length > 0
          ? {
              start: commits[commits.length - 1].date,
              end: commits[0].date,
            }
          : null,

      fileChurn,
      fileOwnership,
      authorStats,

      hotPaths,
      stableCore,
      fragileFiles,
      commitPattern,

      recentCommits: commits.slice(0, 50),
      timeline,

      highChurnFiles,
      multiAuthorFiles,
      recentlyFragile,
    };

    console.error("[Historian] History analysis complete");
    return history;
  } catch (error) {
    console.error("[Historian] Error analyzing history:", error);
    return null;
  }
}

async function processCommits(
  git: SimpleGit,
  log: LogResult<DefaultLogFields>
): Promise<CommitInfo[]> {
  const commits: CommitInfo[] = [];

  for (const entry of log.all) {
    // Get files changed for this commit
    let filesChanged: string[] = [];
    let insertions = 0;
    let deletions = 0;

    try {
      const diff = await git.diff([
        `${entry.hash}^`,
        entry.hash,
        "--name-only",
      ]);
      filesChanged = diff
        .split("\n")
        .filter(Boolean)
        .filter((f) => !f.includes("node_modules"));

      // Get stats
      const stats = await git.diff([
        `${entry.hash}^`,
        entry.hash,
        "--stat",
        "--stat-width=1000",
      ]);
      const statsMatch = stats.match(/(\d+) insertions?\(\+\)/);
      const delMatch = stats.match(/(\d+) deletions?\(-\)/);
      if (statsMatch) insertions = parseInt(statsMatch[1], 10);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
    } catch {
      // First commit or error - skip file details
    }

    const message = entry.message;
    const messageLower = message.toLowerCase();

    commits.push({
      hash: entry.hash,
      shortHash: entry.hash.substring(0, 7),
      author: entry.author_name,
      email: entry.author_email,
      date: entry.date,
      timestamp: new Date(entry.date).getTime(),
      message,
      messageFirstLine: message.split("\n")[0],
      filesChanged,
      insertions,
      deletions,
      isMerge: message.toLowerCase().startsWith("merge"),
      isRevert: messageLower.includes("revert"),
      isRefactor: messageLower.includes("refactor"),
      isFix: messageLower.includes("fix") || messageLower.includes("bug"),
      isFeature:
        messageLower.includes("feat") ||
        messageLower.includes("add") ||
        messageLower.includes("implement"),
    });
  }

  return commits;
}

function analyzeFileChurn(commits: CommitInfo[]): Record<string, FileChurn> {
  const churn: Record<string, FileChurn> = {};
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  for (const commit of commits) {
    for (const file of commit.filesChanged) {
      if (!churn[file]) {
        churn[file] = {
          path: file,
          totalCommits: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          netChange: 0,
          authors: [],
          authorCount: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
          daysSinceLastChange: 0,
          commitsLast30Days: 0,
          commitsLast90Days: 0,
          churnScore: 0,
        };
      }

      const fc = churn[file];
      fc.totalCommits++;
      fc.totalInsertions += commit.insertions / Math.max(commit.filesChanged.length, 1);
      fc.totalDeletions += commit.deletions / Math.max(commit.filesChanged.length, 1);

      if (!fc.authors.includes(commit.author)) {
        fc.authors.push(commit.author);
      }

      // Track first/last commits
      if (new Date(commit.date) < new Date(fc.firstCommit)) {
        fc.firstCommit = commit.date;
      }
      if (new Date(commit.date) > new Date(fc.lastCommit)) {
        fc.lastCommit = commit.date;
      }

      // Track recent activity
      if (commit.timestamp > thirtyDaysAgo) {
        fc.commitsLast30Days++;
      }
      if (commit.timestamp > ninetyDaysAgo) {
        fc.commitsLast90Days++;
      }
    }
  }

  // Calculate derived values
  for (const file of Object.keys(churn)) {
    const fc = churn[file];
    fc.authorCount = fc.authors.length;
    fc.netChange = fc.totalInsertions - fc.totalDeletions;
    fc.daysSinceLastChange = Math.floor(
      (now - new Date(fc.lastCommit).getTime()) / (24 * 60 * 60 * 1000)
    );

    // Calculate churn score (higher = more volatile)
    // Factors: commit frequency, author diversity, recent activity
    fc.churnScore = calculateChurnScore(fc);
  }

  return churn;
}

function calculateChurnScore(fc: FileChurn): number {
  let score = 0;

  // Base score from total commits
  score += Math.min(fc.totalCommits * 2, 30);

  // Bonus for multiple authors (ownership unclear)
  if (fc.authorCount > 1) score += (fc.authorCount - 1) * 5;
  if (fc.authorCount > 3) score += 10; // Extra penalty for many authors

  // Recent activity weight
  score += fc.commitsLast30Days * 3;
  score += fc.commitsLast90Days * 1;

  // High insertion/deletion ratio suggests rewrites
  const totalChanges = fc.totalInsertions + fc.totalDeletions;
  if (totalChanges > 500) score += 10;
  if (totalChanges > 1000) score += 10;

  return Math.round(score);
}

function analyzeAuthorStats(commits: CommitInfo[]): Record<string, AuthorStats> {
  const stats: Record<string, AuthorStats> = {};

  for (const commit of commits) {
    const key = commit.author;
    if (!stats[key]) {
      stats[key] = {
        name: commit.author,
        email: commit.email,
        totalCommits: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        filesOwned: [],
        filesContributed: [],
        firstCommit: commit.date,
        lastCommit: commit.date,
        activeDays: 0,
        averageCommitsPerDay: 0,
      };
    }

    const author = stats[key];
    author.totalCommits++;
    author.totalInsertions += commit.insertions;
    author.totalDeletions += commit.deletions;

    for (const file of commit.filesChanged) {
      if (!author.filesContributed.includes(file)) {
        author.filesContributed.push(file);
      }
    }

    if (new Date(commit.date) < new Date(author.firstCommit)) {
      author.firstCommit = commit.date;
    }
    if (new Date(commit.date) > new Date(author.lastCommit)) {
      author.lastCommit = commit.date;
    }
  }

  // Calculate derived values
  for (const key of Object.keys(stats)) {
    const author = stats[key];
    const daySpan = Math.max(
      1,
      Math.floor(
        (new Date(author.lastCommit).getTime() -
          new Date(author.firstCommit).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    );
    author.activeDays = daySpan;
    author.averageCommitsPerDay = Math.round((author.totalCommits / daySpan) * 100) / 100;
  }

  return stats;
}

function analyzeFileOwnership(
  fileChurn: Record<string, FileChurn>,
  commits: CommitInfo[]
): Record<string, FileOwnership> {
  const ownership: Record<string, FileOwnership> = {};

  // Count commits per author per file
  const fileAuthorCommits: Record<string, Record<string, { count: number; lastCommit: string }>> = {};

  for (const commit of commits) {
    for (const file of commit.filesChanged) {
      if (!fileAuthorCommits[file]) {
        fileAuthorCommits[file] = {};
      }
      if (!fileAuthorCommits[file][commit.author]) {
        fileAuthorCommits[file][commit.author] = { count: 0, lastCommit: commit.date };
      }
      fileAuthorCommits[file][commit.author].count++;
      if (new Date(commit.date) > new Date(fileAuthorCommits[file][commit.author].lastCommit)) {
        fileAuthorCommits[file][commit.author].lastCommit = commit.date;
      }
    }
  }

  // Build ownership records
  for (const file of Object.keys(fileChurn)) {
    const authorData = fileAuthorCommits[file] || {};
    const totalCommits = fileChurn[file].totalCommits;

    const contributors = Object.entries(authorData)
      .map(([author, data]) => ({
        author,
        commits: data.count,
        percent: Math.round((data.count / totalCommits) * 100),
        lastCommit: data.lastCommit,
      }))
      .sort((a, b) => b.commits - a.commits);

    const primaryAuthor = contributors.length > 0 ? contributors[0].author : null;
    const primaryAuthorPercent = contributors.length > 0 ? contributors[0].percent : 0;

    // Determine ownership clarity
    let ownershipClarity: "clear" | "shared" | "disputed" = "clear";
    if (contributors.length >= 3 && contributors[0].percent < 50) {
      ownershipClarity = "disputed";
    } else if (contributors.length >= 2 && contributors[0].percent < 70) {
      ownershipClarity = "shared";
    }

    ownership[file] = {
      path: file,
      primaryAuthor,
      primaryAuthorPercent,
      contributors: contributors.slice(0, 5),
      ownershipClarity,
    };
  }

  return ownership;
}

function identifyHotPaths(fileChurn: Record<string, FileChurn>): HotPath[] {
  const hotPaths: HotPath[] = [];

  for (const [path, churn] of Object.entries(fileChurn)) {
    // Skip non-source files
    if (path.includes("package-lock") || path.includes("yarn.lock")) continue;

    const reasons: string[] = [];
    let riskLevel: "high" | "medium" | "low" = "low";

    if (churn.churnScore > 50) {
      reasons.push(`Very high churn (score: ${churn.churnScore})`);
      riskLevel = "high";
    } else if (churn.churnScore > 30) {
      reasons.push(`High churn (score: ${churn.churnScore})`);
      if (riskLevel === "low") riskLevel = "medium";
    }

    if (churn.commitsLast30Days >= 5) {
      reasons.push(`${churn.commitsLast30Days} commits in last 30 days`);
      riskLevel = "high";
    }

    if (churn.authorCount >= 4) {
      reasons.push(`${churn.authorCount} different authors`);
      if (riskLevel === "low") riskLevel = "medium";
    }

    if (reasons.length > 0) {
      hotPaths.push({
        path,
        reason: reasons.join("; "),
        churnScore: churn.churnScore,
        recentCommits: churn.commitsLast30Days,
        authorCount: churn.authorCount,
        riskLevel,
      });
    }
  }

  return hotPaths.sort((a, b) => b.churnScore - a.churnScore).slice(0, 20);
}

function identifyStableCore(fileChurn: Record<string, FileChurn>): string[] {
  // Files that exist but rarely change - the reliable foundation
  return Object.entries(fileChurn)
    .filter(([path, churn]) => {
      // Must have some history
      if (churn.totalCommits < 2) return false;
      // Must be old enough
      if (churn.daysSinceLastChange < 60) return false;
      // Must have low churn
      if (churn.churnScore > 15) return false;
      // Skip config files
      if (path.includes("config") || path.endsWith(".json")) return false;
      return true;
    })
    .sort((a, b) => a[1].churnScore - b[1].churnScore)
    .slice(0, 15)
    .map(([path]) => path);
}

function identifyFragileFiles(
  fileChurn: Record<string, FileChurn>,
  fileOwnership: Record<string, FileOwnership>,
  commits: CommitInfo[]
): FragileFile[] {
  const fragileFiles: FragileFile[] = [];

  // Build fix commit map
  const fixCommitsPerFile: Record<string, number> = {};
  for (const commit of commits) {
    if (commit.isFix) {
      for (const file of commit.filesChanged) {
        fixCommitsPerFile[file] = (fixCommitsPerFile[file] || 0) + 1;
      }
    }
  }

  // Analyze each file
  for (const [path, churn] of Object.entries(fileChurn)) {
    const evidence: FragileFile["evidence"] = [];
    const reasons: string[] = [];

    // High churn
    if (churn.churnScore > 40) {
      evidence.push({
        type: "high-churn",
        detail: `Changed ${churn.totalCommits} times with churn score ${churn.churnScore}`,
        severity: Math.min(10, Math.floor(churn.churnScore / 5)),
      });
      reasons.push("Frequently rewritten");
    }

    // Many authors
    if (churn.authorCount >= 4) {
      evidence.push({
        type: "many-authors",
        detail: `${churn.authorCount} different people have modified this file`,
        severity: Math.min(10, churn.authorCount),
      });
      reasons.push("Unclear ownership");
    }

    // Frequent fixes
    const fixes = fixCommitsPerFile[path] || 0;
    if (fixes >= 3) {
      evidence.push({
        type: "frequent-fixes",
        detail: `${fixes} bug fix commits reference this file`,
        severity: Math.min(10, fixes),
      });
      reasons.push("Bug-prone");
    }

    // Recent rewrites (high changes in short time)
    if (churn.commitsLast30Days >= 5 && churn.totalCommits <= 10) {
      evidence.push({
        type: "recent-rewrites",
        detail: `${churn.commitsLast30Days} of ${churn.totalCommits} total commits were in last 30 days`,
        severity: 7,
      });
      reasons.push("Recently volatile");
    }

    // Yo-yo changes (high net change suggests constant rewrites)
    const totalChange = churn.totalInsertions + churn.totalDeletions;
    if (totalChange > 1000 && churn.totalCommits > 5) {
      evidence.push({
        type: "yo-yo-changes",
        detail: `${Math.round(totalChange)} lines changed across ${churn.totalCommits} commits`,
        severity: Math.min(10, Math.floor(totalChange / 200)),
      });
      reasons.push("Heavily modified");
    }

    if (evidence.length > 0) {
      const fragileScore = evidence.reduce((sum, e) => sum + e.severity, 0);
      const ownership = fileOwnership[path];

      let recommendation = "Review this file for potential refactoring.";
      if (churn.authorCount >= 4) {
        recommendation = "Assign clear ownership and document expected behavior.";
      }
      if (fixes >= 3) {
        recommendation = "Add comprehensive tests and consider a rewrite.";
      }

      fragileFiles.push({
        path,
        reasons,
        evidence,
        fragileScore,
        recommendation,
      });
    }
  }

  return fragileFiles.sort((a, b) => b.fragileScore - a.fragileScore).slice(0, 20);
}

function analyzeCommitPattern(commits: CommitInfo[]): CommitPattern {
  if (commits.length === 0) {
    return {
      type: "abandoned",
      description: "No commits found",
      averageCommitsPerWeek: 0,
      longestGapDays: 0,
      busiestPeriod: null,
    };
  }

  const now = Date.now();
  const lastCommitAge = (now - commits[0].timestamp) / (24 * 60 * 60 * 1000);

  // Check if abandoned
  if (lastCommitAge > 180) {
    return {
      type: "abandoned",
      description: `No commits in ${Math.floor(lastCommitAge)} days`,
      averageCommitsPerWeek: 0,
      longestGapDays: Math.floor(lastCommitAge),
      busiestPeriod: null,
    };
  }

  // Calculate commit frequency
  const firstCommit = commits[commits.length - 1];
  const daySpan = Math.max(
    1,
    (commits[0].timestamp - firstCommit.timestamp) / (24 * 60 * 60 * 1000)
  );
  const weekSpan = daySpan / 7;
  const averageCommitsPerWeek = Math.round((commits.length / weekSpan) * 10) / 10;

  // Find longest gap
  let longestGapDays = 0;
  for (let i = 0; i < commits.length - 1; i++) {
    const gap = (commits[i].timestamp - commits[i + 1].timestamp) / (24 * 60 * 60 * 1000);
    if (gap > longestGapDays) {
      longestGapDays = Math.floor(gap);
    }
  }

  // Find busiest period (sliding 30-day window)
  let busiestPeriod: CommitPattern["busiestPeriod"] = null;
  let maxCommits = 0;

  for (let i = 0; i < commits.length; i++) {
    const windowEnd = commits[i].timestamp;
    const windowStart = windowEnd - 30 * 24 * 60 * 60 * 1000;
    const windowCommits = commits.filter(
      (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd
    );
    if (windowCommits.length > maxCommits) {
      maxCommits = windowCommits.length;
      busiestPeriod = {
        start: new Date(windowStart).toISOString().split("T")[0],
        end: new Date(windowEnd).toISOString().split("T")[0],
        commits: windowCommits.length,
      };
    }
  }

  // Determine pattern type
  let type: CommitPattern["type"];
  let description: string;

  if (averageCommitsPerWeek >= 5) {
    type = "active";
    description = `Highly active with ~${averageCommitsPerWeek} commits/week`;
  } else if (averageCommitsPerWeek >= 1) {
    type = "steady";
    description = `Steady development with ~${averageCommitsPerWeek} commits/week`;
  } else if (longestGapDays > 30) {
    type = "sporadic";
    description = `Sporadic activity with gaps up to ${longestGapDays} days`;
  } else {
    type = "burst";
    description = `Development in bursts, currently ${lastCommitAge < 7 ? "active" : "quiet"}`;
  }

  return {
    type,
    description,
    averageCommitsPerWeek,
    longestGapDays,
    busiestPeriod,
  };
}

function buildTimeline(
  commits: CommitInfo[],
  fileChurn: Record<string, FileChurn>
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add recent significant commits
  for (const commit of commits.slice(0, 20)) {
    if (commit.isMerge) continue;

    let type: TimelineEvent["type"] = "commit";
    let description = commit.messageFirstLine;

    if (commit.isRefactor) {
      type = "major-refactor";
      description = `Refactor: ${commit.messageFirstLine}`;
    }

    if (commit.filesChanged.length > 10) {
      description = `Large change (${commit.filesChanged.length} files): ${commit.messageFirstLine}`;
    }

    events.push({
      date: commit.date,
      type,
      description,
      files: commit.filesChanged.slice(0, 5),
      author: commit.author,
    });
  }

  // Detect quiet periods (gaps > 14 days)
  for (let i = 0; i < commits.length - 1; i++) {
    const gap = (commits[i].timestamp - commits[i + 1].timestamp) / (24 * 60 * 60 * 1000);
    if (gap > 14) {
      events.push({
        date: commits[i + 1].date,
        type: "quiet-period",
        description: `${Math.floor(gap)} day gap in development`,
      });
    }
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
