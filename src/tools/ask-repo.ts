import { repoCache } from "../index.js";
import { RepoAnalysis } from "../types.js";

/**
 * Answer questions about an analyzed repository
 */
export async function askRepo(question: string, repoPath?: string): Promise<string> {
  const analysis = repoCache.get(repoPath);

  if (!analysis) {
    return `No repository has been analyzed yet. Please run analyze_repo first with the path to your repository.`;
  }

  const q = question.toLowerCase();

  // Route to appropriate handler based on question type
  if (matchesAny(q, ["what does", "what is", "purpose", "about", "overview"])) {
    return answerAboutPurpose(analysis);
  }

  if (matchesAny(q, ["structure", "organized", "layout", "architecture", "folders"])) {
    return answerAboutStructure(analysis);
  }

  if (matchesAny(q, ["tech", "stack", "framework", "using", "built with"])) {
    return answerAboutTechStack(analysis);
  }

  if (matchesAny(q, ["depend", "package", "library", "libraries"])) {
    return answerAboutDependencies(analysis);
  }

  if (matchesAny(q, ["risk", "concern", "problem", "issue", "worry", "scare", "afraid"])) {
    return answerAboutRisks(analysis);
  }

  if (matchesAny(q, ["break", "remove", "delete", "change"])) {
    return answerAboutImpact(analysis, question);
  }

  if (matchesAny(q, ["why", "reason", "decision"])) {
    return answerAboutDecisions(analysis, question);
  }

  if (matchesAny(q, ["who", "contributor", "author", "team"])) {
    return answerAboutContributors(analysis);
  }

  if (matchesAny(q, ["recent", "latest", "last", "history", "commit"])) {
    return answerAboutHistory(analysis);
  }

  if (matchesAny(q, ["large", "big", "biggest", "complex"])) {
    return answerAboutComplexity(analysis);
  }

  // Default: provide a general answer with available insights
  return generateGeneralAnswer(analysis, question);
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function answerAboutPurpose(analysis: RepoAnalysis): string {
  const lines: string[] = [`# What does ${analysis.name} do?\n`];

  // Infer purpose from tech stack and structure
  if (analysis.techStack.length > 0) {
    lines.push(`This appears to be a **${analysis.techStack.slice(0, 3).join(" + ")}** project.\n`);
  }

  // Look at structure for hints
  const dirs = analysis.structure.topLevelDirs;
  if (dirs.includes("src")) {
    if (dirs.includes("api") || dirs.includes("routes")) {
      lines.push("Based on the structure, this looks like a **backend API service**.");
    } else if (dirs.includes("components") || dirs.includes("pages")) {
      lines.push("Based on the structure, this looks like a **frontend application**.");
    } else {
      lines.push("This appears to be a library or standalone application.");
    }
  }

  lines.push(`\n**Entry points:** ${analysis.structure.entryPoints.join(", ") || "Not detected"}`);
  lines.push(`\n**Scale:** ${analysis.codeMetrics.totalFiles} files, ${analysis.codeMetrics.totalLines.toLocaleString()} lines of code`);

  if (!analysis.structure.hasReadme) {
    lines.push(`\n⚠️ No README found - consider adding one to document the project's purpose.`);
  }

  return lines.join("\n");
}

function answerAboutStructure(analysis: RepoAnalysis): string {
  const lines: string[] = [`# Repository Structure\n`];

  lines.push(`## Top-level directories`);
  for (const dir of analysis.structure.topLevelDirs) {
    lines.push(`- \`${dir}/\``);
  }

  lines.push(`\n## Configuration files`);
  for (const file of analysis.structure.configFiles.slice(0, 10)) {
    lines.push(`- \`${file}\``);
  }

  lines.push(`\n## Files by type`);
  const sorted = Object.entries(analysis.codeMetrics.filesByExtension)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  for (const [ext, count] of sorted) {
    lines.push(`- ${ext}: ${count} files`);
  }

  return lines.join("\n");
}

function answerAboutTechStack(analysis: RepoAnalysis): string {
  if (analysis.techStack.length === 0) {
    return "Unable to detect the tech stack. The repository may use technologies I don't recognize, or it may not have standard configuration files.";
  }

  const lines: string[] = [`# Tech Stack\n`];

  for (const tech of analysis.techStack) {
    lines.push(`- **${tech}**`);
  }

  // Add insights about the stack
  if (analysis.techStack.includes("TypeScript")) {
    lines.push(`\n✓ TypeScript is configured (type safety enabled)`);
  }

  const frameworks = analysis.techStack.filter((t) =>
    ["React", "Vue", "Angular", "Express", "Fastify", "Next.js", "NestJS"].includes(t)
  );
  if (frameworks.length > 0) {
    lines.push(`\n**Primary framework:** ${frameworks[0]}`);
  }

  return lines.join("\n");
}

function answerAboutDependencies(analysis: RepoAnalysis): string {
  if (analysis.dependencies.length === 0) {
    return "No package.json found or no dependencies detected.";
  }

  const prod = analysis.dependencies.filter((d) => d.type === "production");
  const dev = analysis.dependencies.filter((d) => d.type === "development");

  const lines: string[] = [`# Dependencies\n`];

  lines.push(`**Production dependencies:** ${prod.length}`);
  for (const dep of prod.slice(0, 15)) {
    lines.push(`- ${dep.name}@${dep.version}`);
  }
  if (prod.length > 15) {
    lines.push(`- ... and ${prod.length - 15} more`);
  }

  lines.push(`\n**Dev dependencies:** ${dev.length}`);
  for (const dep of dev.slice(0, 10)) {
    lines.push(`- ${dep.name}@${dep.version}`);
  }
  if (dev.length > 10) {
    lines.push(`- ... and ${dev.length - 10} more`);
  }

  return lines.join("\n");
}

function answerAboutRisks(analysis: RepoAnalysis): string {
  if (analysis.risks.length === 0) {
    return "No significant risks identified! The codebase appears well-structured.";
  }

  const lines: string[] = [`# Risk Assessment\n`];

  const high = analysis.risks.filter((r) => r.severity === "high");
  const medium = analysis.risks.filter((r) => r.severity === "medium");
  const low = analysis.risks.filter((r) => r.severity === "low");

  if (high.length > 0) {
    lines.push(`## 🔴 High Severity (${high.length})\n`);
    for (const risk of high) {
      lines.push(`### ${risk.file || "General"}`);
      lines.push(`${risk.description}`);
      lines.push(`**Recommendation:** ${risk.recommendation}\n`);
    }
  }

  if (medium.length > 0) {
    lines.push(`## 🟡 Medium Severity (${medium.length})\n`);
    for (const risk of medium) {
      lines.push(`- **${risk.file || "General"}:** ${risk.description}`);
    }
  }

  if (low.length > 0) {
    lines.push(`\n## 🟢 Low Severity (${low.length})\n`);
    for (const risk of low) {
      lines.push(`- ${risk.description}`);
    }
  }

  return lines.join("\n");
}

function answerAboutImpact(analysis: RepoAnalysis, question: string): string {
  const lines: string[] = [`# Impact Analysis\n`];

  lines.push(`To understand what might break, I analyzed:`);
  lines.push(`- Entry points: ${analysis.structure.entryPoints.join(", ") || "None detected"}`);
  lines.push(`- High-churn files (frequently changing):`);

  if (analysis.gitMetrics?.mostChangedFiles) {
    for (const file of analysis.gitMetrics.mostChangedFiles.slice(0, 5)) {
      lines.push(`  - \`${file.path}\` (${file.changes} recent changes)`);
    }
  } else {
    lines.push(`  - Git history not available`);
  }

  lines.push(`\n**Key insight:** Files that change frequently are often central to the system.`);
  lines.push(`Removing or significantly modifying them is likely to have cascading effects.`);

  // Look for specific files mentioned in the question
  const largeFiles = analysis.codeMetrics.largestFiles;
  if (largeFiles.length > 0) {
    lines.push(`\n**Largest files (potential complexity hubs):**`);
    for (const file of largeFiles.slice(0, 3)) {
      lines.push(`- \`${file.path}\` (${file.lineCount} lines)`);
    }
  }

  return lines.join("\n");
}

function answerAboutDecisions(analysis: RepoAnalysis, question: string): string {
  const lines: string[] = [`# Architecture Insights\n`];

  lines.push(`Based on the repository analysis, here are some observable decisions:\n`);

  // TypeScript choice
  if (analysis.techStack.includes("TypeScript")) {
    lines.push(`**TypeScript:** The team chose type safety, suggesting a focus on maintainability and catching errors early.`);
  }

  // Framework choices
  if (analysis.techStack.includes("React")) {
    lines.push(`\n**React:** Component-based UI architecture chosen for building interactive interfaces.`);
  }
  if (analysis.techStack.includes("Express")) {
    lines.push(`\n**Express:** Minimal, flexible Node.js web framework - suggests preference for simplicity over convention.`);
  }
  if (analysis.techStack.includes("NestJS")) {
    lines.push(`\n**NestJS:** Opinionated framework with decorators - team values structure and enterprise patterns.`);
  }

  // Structure decisions
  if (analysis.structure.topLevelDirs.includes("src")) {
    lines.push(`\n**Source organization:** Code is organized under \`src/\`, following common conventions.`);
  }

  if (analysis.gitMetrics) {
    lines.push(`\n**Development activity:** ${analysis.gitMetrics.contributors.length} contributor(s), ${analysis.gitMetrics.totalCommits} total commits.`);
  }

  return lines.join("\n");
}

function answerAboutContributors(analysis: RepoAnalysis): string {
  if (!analysis.gitMetrics) {
    return "Git history is not available for this repository.";
  }

  const lines: string[] = [`# Contributors\n`];

  lines.push(`**Total contributors:** ${analysis.gitMetrics.contributors.length}\n`);

  for (const contributor of analysis.gitMetrics.contributors.slice(0, 10)) {
    lines.push(`- ${contributor}`);
  }

  if (analysis.gitMetrics.contributors.length > 10) {
    lines.push(`- ... and ${analysis.gitMetrics.contributors.length - 10} more`);
  }

  return lines.join("\n");
}

function answerAboutHistory(analysis: RepoAnalysis): string {
  if (!analysis.gitMetrics) {
    return "Git history is not available for this repository.";
  }

  const lines: string[] = [`# Recent History\n`];

  lines.push(`**Total commits:** ${analysis.gitMetrics.totalCommits}`);
  if (analysis.gitMetrics.firstCommitDate) {
    lines.push(`**First commit:** ${analysis.gitMetrics.firstCommitDate}`);
  }
  if (analysis.gitMetrics.lastCommitDate) {
    lines.push(`**Last commit:** ${analysis.gitMetrics.lastCommitDate}`);
  }

  lines.push(`\n## Recent commits\n`);
  for (const commit of analysis.gitMetrics.recentCommits.slice(0, 10)) {
    lines.push(`- **${commit.hash}** ${commit.message} (${commit.author})`);
  }

  return lines.join("\n");
}

function answerAboutComplexity(analysis: RepoAnalysis): string {
  const lines: string[] = [`# Complexity Analysis\n`];

  lines.push(`## Largest files\n`);
  for (const file of analysis.codeMetrics.largestFiles.slice(0, 10)) {
    const indicator =
      file.lineCount > 1000 ? "🔴" : file.lineCount > 500 ? "🟡" : "🟢";
    lines.push(`${indicator} \`${file.path}\` - ${file.lineCount} lines`);
  }

  lines.push(`\n## File distribution\n`);
  const sorted = Object.entries(analysis.codeMetrics.filesByExtension)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  for (const [ext, count] of sorted) {
    lines.push(`- ${ext}: ${count} files`);
  }

  lines.push(`\n**Average file size:** ${analysis.codeMetrics.averageFileSize} bytes`);

  return lines.join("\n");
}

function generateGeneralAnswer(analysis: RepoAnalysis, question: string): string {
  const lines: string[] = [
    `# About ${analysis.name}\n`,
    `I analyzed this repository and here's what I found:\n`,
    `**Tech Stack:** ${analysis.techStack.join(", ") || "Unknown"}`,
    `**Size:** ${analysis.codeMetrics.totalFiles} files, ${analysis.codeMetrics.totalLines.toLocaleString()} lines`,
    `**Structure:** ${analysis.structure.topLevelDirs.join(", ")}`,
  ];

  if (analysis.gitMetrics) {
    lines.push(`**History:** ${analysis.gitMetrics.totalCommits} commits from ${analysis.gitMetrics.contributors.length} contributor(s)`);
  }

  if (analysis.risks.length > 0) {
    lines.push(`**Risks identified:** ${analysis.risks.length}`);
  }

  lines.push(`\nFor more specific information, try asking about:`);
  lines.push(`- Structure and organization`);
  lines.push(`- Tech stack and dependencies`);
  lines.push(`- Risks and concerns`);
  lines.push(`- Recent changes and history`);

  return lines.join("\n");
}
