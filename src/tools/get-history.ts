import { repoCache } from "../index.js";

/**
 * Get git history analysis - the time dimension
 * This explains WHY code is the way it is
 */
export async function getHistory(
  repoPath?: string,
  section?: "churn" | "authors" | "fragile" | "hotPaths" | "timeline" | "ownership" | "all"
): Promise<string> {
  const history = repoCache.getHistory(repoPath);

  if (!history) {
    const snapshot = repoCache.getSnapshot(repoPath);
    if (!snapshot) {
      return JSON.stringify({
        error: "No repository has been analyzed yet. Please run analyze_repo first.",
      });
    }
    return JSON.stringify({
      error: "Git history not available. The repository may not have a .git directory.",
    });
  }

  const selectedSection = section || "all";

  switch (selectedSection) {
    case "churn":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "File churn data - higher scores indicate more volatile files",
          
          highChurnFiles: history.highChurnFiles,
          
          fileChurn: Object.fromEntries(
            Object.entries(history.fileChurn)
              .sort(([, a], [, b]) => b.churnScore - a.churnScore)
              .slice(0, 30)
              .map(([path, churn]) => [
                path,
                {
                  totalCommits: churn.totalCommits,
                  churnScore: churn.churnScore,
                  authors: churn.authors,
                  authorCount: churn.authorCount,
                  commitsLast30Days: churn.commitsLast30Days,
                  commitsLast90Days: churn.commitsLast90Days,
                  daysSinceLastChange: churn.daysSinceLastChange,
                  totalInsertions: Math.round(churn.totalInsertions),
                  totalDeletions: Math.round(churn.totalDeletions),
                },
              ])
          ),
        },
        null,
        2
      );

    case "authors":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "Author statistics and ownership signals",
          
          totalAuthors: history.totalAuthors,
          
          authors: Object.fromEntries(
            Object.entries(history.authorStats)
              .sort(([, a], [, b]) => b.totalCommits - a.totalCommits)
              .map(([name, stats]) => [
                name,
                {
                  totalCommits: stats.totalCommits,
                  totalInsertions: stats.totalInsertions,
                  totalDeletions: stats.totalDeletions,
                  filesContributedCount: stats.filesContributed.length,
                  firstCommit: stats.firstCommit,
                  lastCommit: stats.lastCommit,
                  activeDays: stats.activeDays,
                  averageCommitsPerDay: stats.averageCommitsPerDay,
                },
              ])
          ),
        },
        null,
        2
      );

    case "fragile":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "Fragile files that may cause problems. Higher fragileScore = more concern.",
          
          recentlyFragile: history.recentlyFragile,
          
          fragileFiles: history.fragileFiles.map((f) => ({
            path: f.path,
            fragileScore: f.fragileScore,
            reasons: f.reasons,
            evidence: f.evidence,
            recommendation: f.recommendation,
          })),
        },
        null,
        2
      );

    case "hotPaths":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "Hot paths (volatile) vs stable core (reliable)",
          
          hotPaths: history.hotPaths,
          stableCore: history.stableCore,
        },
        null,
        2
      );

    case "timeline":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "Timeline of significant events",
          
          commitPattern: history.commitPattern,
          dateRange: history.dateRange,
          
          recentCommits: history.recentCommits.slice(0, 20).map((c) => ({
            hash: c.shortHash,
            date: c.date,
            author: c.author,
            message: c.messageFirstLine,
            filesChanged: c.filesChanged.length,
            isFix: c.isFix,
            isRefactor: c.isRefactor,
            isFeature: c.isFeature,
          })),
          
          timeline: history.timeline.slice(0, 20),
        },
        null,
        2
      );

    case "ownership":
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "File ownership analysis - who owns what",
          
          multiAuthorFiles: history.multiAuthorFiles,
          
          ownership: Object.fromEntries(
            Object.entries(history.fileOwnership)
              .filter(([, o]) => o.contributors.length > 1)
              .sort(([, a], [, b]) => {
                // Sort by ownership clarity (disputed first)
                const order = { disputed: 0, shared: 1, clear: 2 };
                return order[a.ownershipClarity] - order[b.ownershipClarity];
              })
              .slice(0, 30)
              .map(([path, ownership]) => [
                path,
                {
                  primaryAuthor: ownership.primaryAuthor,
                  primaryAuthorPercent: ownership.primaryAuthorPercent,
                  ownershipClarity: ownership.ownershipClarity,
                  contributors: ownership.contributors,
                },
              ])
          ),
        },
        null,
        2
      );

    case "all":
    default:
      return JSON.stringify(
        {
          _citation: `Source: Git history analysis of ${history.repoPath} (${history.analyzedAt})`,
          _note: "This is the time dimension - it explains WHY code is the way it is.",
          _usage: "Use section parameter ('churn', 'authors', 'fragile', 'hotPaths', 'timeline', 'ownership') for detailed data.",
          
          summary: {
            totalCommits: history.totalCommits,
            totalAuthors: history.totalAuthors,
            dateRange: history.dateRange,
            commitPattern: history.commitPattern,
          },
          
          insights: {
            highChurnFiles: history.highChurnFiles,
            multiAuthorFiles: history.multiAuthorFiles,
            recentlyFragile: history.recentlyFragile,
            stableCore: history.stableCore.slice(0, 10),
          },
          
          hotPaths: history.hotPaths.slice(0, 10).map((h) => ({
            path: h.path,
            reason: h.reason,
            riskLevel: h.riskLevel,
          })),
          
          fragileFiles: history.fragileFiles.slice(0, 10).map((f) => ({
            path: f.path,
            reasons: f.reasons,
            fragileScore: f.fragileScore,
          })),
          
          topAuthors: Object.entries(history.authorStats)
            .sort(([, a], [, b]) => b.totalCommits - a.totalCommits)
            .slice(0, 5)
            .map(([name, stats]) => ({
              name,
              commits: stats.totalCommits,
              filesContributed: stats.filesContributed.length,
            })),
        },
        null,
        2
      );
  }
}

/**
 * Ask a specific question about git history
 * Returns a natural language answer with citations
 */
export async function whyIsThisWeird(filePath: string, repoPath?: string): Promise<string> {
  const history = repoCache.getHistory(repoPath);

  if (!history) {
    return "Cannot analyze - no git history available. Run analyze_repo first.";
  }

  const churn = history.fileChurn[filePath];
  const ownership = history.fileOwnership[filePath];
  const fragile = history.fragileFiles.find((f) => f.path === filePath);

  if (!churn) {
    return `No history found for "${filePath}". The file may be new or the path may be incorrect.`;
  }

  const lines: string[] = [`# Why is "${filePath}" the way it is?\n`];
  lines.push(`*Based on git history analysis*\n`);

  // Churn analysis
  lines.push(`## Change History`);
  lines.push(`- **Total commits:** ${churn.totalCommits}`);
  lines.push(`- **Authors:** ${churn.authorCount} (${churn.authors.join(", ")})`);
  lines.push(`- **Churn score:** ${churn.churnScore} ${churn.churnScore > 40 ? "⚠️ HIGH" : churn.churnScore > 20 ? "🟡 MEDIUM" : "🟢 LOW"}`);
  lines.push(`- **Last changed:** ${churn.daysSinceLastChange} days ago`);
  lines.push(`- **Recent activity:** ${churn.commitsLast30Days} commits in last 30 days`);
  lines.push("");

  // If it's weird, explain why
  if (churn.churnScore > 30 || churn.authorCount >= 3 || fragile) {
    lines.push(`## 🔍 Why It's Unusual\n`);

    if (churn.totalCommits > 20) {
      lines.push(`**Heavily modified:** This file has been changed ${churn.totalCommits} times. That's a lot of iterations - the requirements may have been unclear or the implementation keeps needing fixes.`);
      lines.push("");
    }

    if (churn.authorCount >= 3) {
      lines.push(`**Many hands:** ${churn.authorCount} different people have modified this file. Shared ownership can lead to inconsistent patterns and "design by committee" code.`);
      lines.push("");
    }

    if (churn.commitsLast30Days >= 5) {
      lines.push(`**Currently volatile:** ${churn.commitsLast30Days} commits in the last 30 days suggests active work or recent problems being addressed.`);
      lines.push("");
    }

    if (fragile) {
      lines.push(`**Identified as fragile:** ${fragile.reasons.join(", ")}`);
      lines.push(`\n**Recommendation:** ${fragile.recommendation}`);
      lines.push("");
    }
  } else {
    lines.push(`## ✅ This file looks healthy\n`);
    lines.push(`No significant concerns detected. The file has normal change patterns.`);
  }

  // Ownership
  if (ownership) {
    lines.push(`## Ownership`);
    lines.push(`- **Primary author:** ${ownership.primaryAuthor || "None"} (${ownership.primaryAuthorPercent}%)`);
    lines.push(`- **Ownership clarity:** ${ownership.ownershipClarity}`);
    if (ownership.ownershipClarity === "disputed") {
      lines.push(`\n⚠️ No clear owner - consider assigning ownership.`);
    }
  }

  return lines.join("\n");
}
