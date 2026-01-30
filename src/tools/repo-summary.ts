import { repoCache } from "../index.js";

/**
 * Generate a high-level summary of the analyzed repository
 */
export async function repoSummary(repoPath?: string): Promise<string> {
  const analysis = repoCache.get(repoPath);

  if (!analysis) {
    return `No repository has been analyzed yet. Please run analyze_repo first.`;
  }

  const lines: string[] = [];

  // Header
  lines.push(`╔══════════════════════════════════════════════════════════════╗`);
  lines.push(`║  REPO THERAPIST - Repository Summary                         ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════╝\n`);

  // Basic info
  lines.push(`📁 **${analysis.name}**`);
  lines.push(`   ${analysis.path}\n`);

  // Tech Stack
  lines.push(`🛠️  **Tech Stack**`);
  if (analysis.techStack.length > 0) {
    lines.push(`   ${analysis.techStack.join(" • ")}`);
  } else {
    lines.push(`   Unable to detect`);
  }
  lines.push("");

  // Code Metrics
  lines.push(`📊 **Code Metrics**`);
  lines.push(`   Files: ${analysis.codeMetrics.totalFiles}`);
  lines.push(`   Lines of Code: ${analysis.codeMetrics.totalLines.toLocaleString()}`);
  lines.push(`   Avg File Size: ${formatBytes(analysis.codeMetrics.averageFileSize)}`);
  lines.push("");

  // File breakdown
  const topExtensions = Object.entries(analysis.codeMetrics.filesByExtension)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  if (topExtensions.length > 0) {
    lines.push(`📄 **File Types**`);
    for (const [ext, count] of topExtensions) {
      const bar = "█".repeat(Math.min(Math.ceil(count / 5), 20));
      lines.push(`   ${ext.padEnd(12)} ${bar} ${count}`);
    }
    lines.push("");
  }

  // Git Stats
  if (analysis.gitMetrics) {
    lines.push(`📜 **Git History**`);
    lines.push(`   Total Commits: ${analysis.gitMetrics.totalCommits}`);
    lines.push(`   Contributors: ${analysis.gitMetrics.contributors.length}`);
    if (analysis.gitMetrics.lastCommitDate) {
      lines.push(`   Last Commit: ${formatDate(analysis.gitMetrics.lastCommitDate)}`);
    }
    if (analysis.gitMetrics.firstCommitDate) {
      lines.push(`   First Commit: ${formatDate(analysis.gitMetrics.firstCommitDate)}`);
    }
    lines.push("");

    // Contributors
    if (analysis.gitMetrics.contributors.length > 0) {
      lines.push(`👥 **Contributors**`);
      for (const contributor of analysis.gitMetrics.contributors.slice(0, 5)) {
        lines.push(`   • ${contributor}`);
      }
      if (analysis.gitMetrics.contributors.length > 5) {
        lines.push(`   ... and ${analysis.gitMetrics.contributors.length - 5} more`);
      }
      lines.push("");
    }
  }

  // Structure
  lines.push(`🏗️  **Project Structure**`);
  lines.push(`   Directories: ${analysis.structure.topLevelDirs.join(", ") || "None"}`);
  lines.push(`   Entry Points: ${analysis.structure.entryPoints.join(", ") || "Not detected"}`);
  lines.push("");

  // Health indicators
  lines.push(`✅ **Health Indicators**`);
  lines.push(`   ${analysis.structure.hasReadme ? "✓" : "✗"} README`);
  lines.push(`   ${analysis.structure.hasPackageJson ? "✓" : "✗"} package.json`);
  lines.push(`   ${analysis.structure.hasTsConfig ? "✓" : "✗"} TypeScript config`);
  lines.push(`   ${analysis.structure.hasGitIgnore ? "✓" : "✗"} .gitignore`);
  lines.push("");

  // Dependencies summary
  if (analysis.dependencies.length > 0) {
    const prodDeps = analysis.dependencies.filter((d) => d.type === "production");
    const devDeps = analysis.dependencies.filter((d) => d.type === "development");
    lines.push(`📦 **Dependencies**`);
    lines.push(`   Production: ${prodDeps.length}`);
    lines.push(`   Development: ${devDeps.length}`);
    lines.push("");
  }

  // Risk summary
  const highRisks = analysis.risks.filter((r) => r.severity === "high");
  const medRisks = analysis.risks.filter((r) => r.severity === "medium");
  const lowRisks = analysis.risks.filter((r) => r.severity === "low");

  lines.push(`⚠️  **Risk Summary**`);
  if (analysis.risks.length === 0) {
    lines.push(`   No significant risks identified! 🎉`);
  } else {
    if (highRisks.length > 0) lines.push(`   🔴 High: ${highRisks.length}`);
    if (medRisks.length > 0) lines.push(`   🟡 Medium: ${medRisks.length}`);
    if (lowRisks.length > 0) lines.push(`   🟢 Low: ${lowRisks.length}`);
  }
  lines.push("");

  // Footer
  lines.push(`─────────────────────────────────────────────────────────────────`);
  lines.push(`Analyzed: ${formatDate(analysis.analyzedAt)}`);
  lines.push(`Use ask_repo() for detailed questions or risk_report() for full risk analysis.`);

  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
