import { repoCache } from "../index.js";

/**
 * Get the raw snapshot data - the ground truth
 * LLMs must cite this data, not guess
 */
export async function getSnapshot(
  repoPath?: string,
  section?: "files" | "languages" | "entryPoints" | "configs" | "directories" | "all"
): Promise<string> {
  const snapshot = repoCache.getSnapshot(repoPath);

  if (!snapshot) {
    return JSON.stringify({
      error: "No repository has been analyzed yet. Please run analyze_repo first.",
    });
  }

  const selectedSection = section || "all";

  // Return specific sections to avoid overwhelming the context
  switch (selectedSection) {
    case "files":
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          totalFiles: snapshot.totalFiles,
          totalLines: snapshot.totalLines,
          totalSize: snapshot.totalSize,
          files: snapshot.files.map((f) => ({
            path: f.relativePath,
            language: f.language,
            lines: f.lineCount,
            isConfig: f.isConfig,
            isTest: f.isTest,
          })),
        },
        null,
        2
      );

    case "languages":
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          primaryLanguage: snapshot.primaryLanguage,
          languages: snapshot.languages,
        },
        null,
        2
      );

    case "entryPoints":
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          entryPoints: snapshot.entryPoints,
        },
        null,
        2
      );

    case "configs":
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          configs: snapshot.configs,
        },
        null,
        2
      );

    case "directories":
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          directories: snapshot.directories,
        },
        null,
        2
      );

    case "all":
    default:
      // Return a summary view to avoid context overflow
      return JSON.stringify(
        {
          _citation: `Source: Static snapshot of ${snapshot.repoName} (${snapshot.createdAt})`,
          _note: "This is ground truth. Do not guess or infer beyond this data.",
          _usage: "Use section parameter ('files', 'languages', 'entryPoints', 'configs', 'directories') for detailed data.",
          
          metadata: {
            snapshotVersion: snapshot.snapshotVersion,
            repoName: snapshot.repoName,
            repoPath: snapshot.repoPath,
            createdAt: snapshot.createdAt,
          },

          summary: {
            totalFiles: snapshot.totalFiles,
            totalLines: snapshot.totalLines,
            totalSize: snapshot.totalSize,
            primaryLanguage: snapshot.primaryLanguage,
          },

          languages: snapshot.languages.map((l) => ({
            name: l.name,
            fileCount: l.fileCount,
            lineCount: l.lineCount,
            percentage: l.percentage,
          })),

          entryPoints: snapshot.entryPoints,

          directories: snapshot.directories.slice(0, 15),

          configsSummary: {
            packageJson: snapshot.configs.packageJson
              ? {
                  name: snapshot.configs.packageJson.name,
                  version: snapshot.configs.packageJson.version,
                  type: snapshot.configs.packageJson.type,
                  scripts: Object.keys(snapshot.configs.packageJson.scripts),
                  dependencyCount: Object.keys(snapshot.configs.packageJson.dependencies).length,
                  devDependencyCount: Object.keys(snapshot.configs.packageJson.devDependencies).length,
                }
              : null,
            tsConfig: snapshot.configs.tsConfig
              ? {
                  path: snapshot.configs.tsConfig.path,
                  target: snapshot.configs.tsConfig.compilerOptions.target,
                  module: snapshot.configs.tsConfig.compilerOptions.module,
                  strict: snapshot.configs.tsConfig.compilerOptions.strict,
                }
              : null,
            dockerfile: snapshot.configs.dockerfile
              ? {
                  baseImage: snapshot.configs.dockerfile.baseImage,
                  exposedPorts: snapshot.configs.dockerfile.exposedPorts,
                  hasMultiStage: snapshot.configs.dockerfile.hasMultiStage,
                }
              : null,
            ci: snapshot.configs.ci.map((c) => ({
              platform: c.platform,
              path: c.path,
              jobs: c.jobs,
            })),
            hasEslint: !!snapshot.configs.eslint,
            hasPrettier: !!snapshot.configs.prettier,
            hasEnvExample: !!snapshot.configs.envExample,
          },
        },
        null,
        2
      );
  }
}
