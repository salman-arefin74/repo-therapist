import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import {
  RepoSnapshot,
  FileEntry,
  LanguageStats,
  EntryPoint,
  ConfigFiles,
  PackageJsonConfig,
  TsConfigInfo,
  DockerConfig,
  CIConfig,
} from "./types.js";

// Language detection by extension
const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".json": "JSON",
  ".md": "Markdown",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".html": "HTML",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rb": "Ruby",
  ".php": "PHP",
  ".sh": "Shell",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".sql": "SQL",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".proto": "Protocol Buffers",
  ".xml": "XML",
  ".toml": "TOML",
  ".ini": "INI",
  ".env": "Environment",
  ".dockerfile": "Dockerfile",
};

// Config file patterns
const CONFIG_PATTERNS = [
  "package.json",
  "tsconfig*.json",
  "*.config.js",
  "*.config.ts",
  "*.config.mjs",
  ".eslintrc*",
  ".prettierrc*",
  "prettier.config.*",
  "jest.config.*",
  "vitest.config.*",
  "vite.config.*",
  "webpack.config.*",
  "rollup.config.*",
  "babel.config.*",
  ".babelrc*",
  "docker-compose*.yml",
  "docker-compose*.yaml",
  "Dockerfile*",
  ".env*",
  ".gitignore",
  ".dockerignore",
  ".nvmrc",
  ".node-version",
  "Makefile",
  "Cargo.toml",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
  "Gemfile",
  "composer.json",
];

// Test file patterns
const TEST_PATTERNS = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/test/**",
  "**/tests/**",
];

// Generated file patterns
const GENERATED_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.min.*",
  "**/*.generated.*",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
];

/**
 * Scan a repository and create a static snapshot
 * This is the ground truth - LLMs must cite this, not guess
 */
export async function scanRepo(repoPath: string): Promise<RepoSnapshot> {
  const absolutePath = path.resolve(repoPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Repository path does not exist: ${absolutePath}`);
  }

  const repoName = path.basename(absolutePath);
  console.error(`[Scanner] Scanning repository: ${repoName}`);

  // Get all files
  const allFiles = await glob("**/*", {
    cwd: absolutePath,
    nodir: true,
    dot: true,
    ignore: ["**/node_modules/**", "**/.git/**"],
  });

  console.error(`[Scanner] Found ${allFiles.length} files`);

  // Process files
  const files: FileEntry[] = [];
  const languageCounts: Record<string, { files: number; lines: number; extensions: Set<string> }> = {};

  for (const relativePath of allFiles) {
    const fullPath = path.join(absolutePath, relativePath);
    const entry = await processFile(fullPath, relativePath, absolutePath);
    if (entry) {
      files.push(entry);

      // Track language stats
      if (entry.language && entry.lineCount !== null) {
        if (!languageCounts[entry.language]) {
          languageCounts[entry.language] = { files: 0, lines: 0, extensions: new Set() };
        }
        languageCounts[entry.language].files++;
        languageCounts[entry.language].lines += entry.lineCount;
        languageCounts[entry.language].extensions.add(entry.extension);
      }
    }
  }

  // Calculate totals
  const totalLines = files.reduce((sum, f) => sum + (f.lineCount || 0), 0);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Build language stats
  const languages: LanguageStats[] = Object.entries(languageCounts)
    .map(([name, stats]) => ({
      name,
      extensions: Array.from(stats.extensions),
      fileCount: stats.files,
      lineCount: stats.lines,
      percentage: totalLines > 0 ? Math.round((stats.lines / totalLines) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.lineCount - a.lineCount);

  const primaryLanguage = languages.length > 0 ? languages[0].name : null;

  // Parse configs
  const configs = await parseConfigs(absolutePath);

  // Detect entry points
  const entryPoints = detectEntryPoints(absolutePath, configs, files);

  // Analyze directories
  const directories = analyzeDirectories(absolutePath, files);

  const snapshot: RepoSnapshot = {
    snapshotVersion: "1.0",
    createdAt: new Date().toISOString(),
    repoPath: absolutePath,
    repoName,
    files,
    totalFiles: files.length,
    totalLines,
    totalSize,
    languages,
    primaryLanguage,
    entryPoints,
    configs,
    directories,
  };

  console.error(`[Scanner] Snapshot complete: ${files.length} files, ${languages.length} languages`);

  return snapshot;
}

async function processFile(
  fullPath: string,
  relativePath: string,
  repoPath: string
): Promise<FileEntry | null> {
  try {
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) return null;

    const name = path.basename(fullPath);
    const extension = path.extname(fullPath).toLowerCase();
    const language = LANGUAGE_MAP[extension] || null;

    // Detect if config, test, or generated
    const isConfig = isConfigFile(relativePath);
    const isTest = isTestFile(relativePath);
    const isGenerated = isGeneratedFile(relativePath);

    // Count lines for text files
    let lineCount: number | null = null;
    if (isTextFile(extension) && stats.size < 1024 * 1024) {
      // < 1MB
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        lineCount = content.split("\n").length;
      } catch {
        // Binary or unreadable
      }
    }

    return {
      path: fullPath,
      relativePath,
      name,
      extension,
      size: stats.size,
      lineCount,
      language,
      isConfig,
      isTest,
      isGenerated,
    };
  } catch {
    return null;
  }
}

function isTextFile(ext: string): boolean {
  const textExtensions = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".txt", ".yaml", ".yml",
    ".css", ".scss", ".sass", ".less",
    ".html", ".vue", ".svelte",
    ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php",
    ".sh", ".bash", ".zsh",
    ".sql", ".graphql", ".gql",
    ".xml", ".toml", ".ini", ".env",
    ".dockerfile", ".gitignore", ".dockerignore",
  ]);
  return textExtensions.has(ext.toLowerCase()) || ext === "";
}

function isConfigFile(relativePath: string): boolean {
  const name = path.basename(relativePath).toLowerCase();
  return CONFIG_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$", "i");
      return regex.test(name);
    }
    return name === pattern.toLowerCase();
  });
}

function isTestFile(relativePath: string): boolean {
  const lowerPath = relativePath.toLowerCase();
  return (
    lowerPath.includes(".test.") ||
    lowerPath.includes(".spec.") ||
    lowerPath.includes("__tests__") ||
    lowerPath.includes("/test/") ||
    lowerPath.includes("/tests/")
  );
}

function isGeneratedFile(relativePath: string): boolean {
  const lowerPath = relativePath.toLowerCase();
  return (
    lowerPath.includes("node_modules") ||
    lowerPath.includes("/dist/") ||
    lowerPath.includes("/build/") ||
    lowerPath.includes(".min.") ||
    lowerPath.includes(".generated.") ||
    lowerPath === "package-lock.json" ||
    lowerPath === "yarn.lock" ||
    lowerPath === "pnpm-lock.yaml"
  );
}

async function parseConfigs(repoPath: string): Promise<ConfigFiles> {
  const configs: ConfigFiles = {
    packageJson: null,
    tsConfig: null,
    additionalTsConfigs: [],
    dockerfile: null,
    dockerCompose: null,
    ci: [],
    eslint: null,
    prettier: null,
    gitignore: null,
    envExample: null,
    other: [],
  };

  // Parse package.json
  const packageJsonPath = path.join(repoPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    configs.packageJson = parsePackageJson(packageJsonPath);
  }

  // Parse tsconfig.json
  const tsconfigPath = path.join(repoPath, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    configs.tsConfig = parseTsConfig(tsconfigPath);
  }

  // Find additional tsconfigs
  const tsconfigs = await glob("**/tsconfig*.json", {
    cwd: repoPath,
    ignore: ["**/node_modules/**"],
  });
  for (const tc of tsconfigs) {
    if (tc !== "tsconfig.json") {
      const parsed = parseTsConfig(path.join(repoPath, tc));
      if (parsed) {
        configs.additionalTsConfigs.push(parsed);
      }
    }
  }

  // Parse Dockerfile
  const dockerfiles = await glob("Dockerfile*", { cwd: repoPath });
  if (dockerfiles.length > 0) {
    configs.dockerfile = parseDockerfile(path.join(repoPath, dockerfiles[0]));
  }

  // Docker Compose
  const composeFiles = await glob("docker-compose*.{yml,yaml}", { cwd: repoPath });
  if (composeFiles.length > 0) {
    configs.dockerCompose = composeFiles[0];
  }

  // CI Configs
  configs.ci = await detectCIConfigs(repoPath);

  // ESLint
  const eslintFiles = await glob(".eslintrc*", { cwd: repoPath });
  if (eslintFiles.length > 0) {
    configs.eslint = eslintFiles[0];
  } else if (fs.existsSync(path.join(repoPath, "eslint.config.js"))) {
    configs.eslint = "eslint.config.js";
  }

  // Prettier
  const prettierFiles = await glob(".prettierrc*", { cwd: repoPath });
  if (prettierFiles.length > 0) {
    configs.prettier = prettierFiles[0];
  } else if (fs.existsSync(path.join(repoPath, "prettier.config.js"))) {
    configs.prettier = "prettier.config.js";
  }

  // Gitignore
  const gitignorePath = path.join(repoPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    configs.gitignore = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }

  // .env.example
  if (fs.existsSync(path.join(repoPath, ".env.example"))) {
    configs.envExample = ".env.example";
  } else if (fs.existsSync(path.join(repoPath, ".env.sample"))) {
    configs.envExample = ".env.sample";
  }

  // Find other notable config files
  const otherConfigs = await glob(
    "{vite,webpack,rollup,babel,jest,vitest}.config.{js,ts,mjs}",
    { cwd: repoPath }
  );
  for (const cfg of otherConfigs) {
    configs.other.push({ name: path.basename(cfg, path.extname(cfg)), path: cfg });
  }

  return configs;
}

function parsePackageJson(filePath: string): PackageJsonConfig | null {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      name: content.name || null,
      version: content.version || null,
      description: content.description || null,
      main: content.main || null,
      bin: content.bin || null,
      scripts: content.scripts || {},
      dependencies: content.dependencies || {},
      devDependencies: content.devDependencies || {},
      peerDependencies: content.peerDependencies || {},
      engines: content.engines || null,
      type: content.type || null,
    };
  } catch {
    return null;
  }
}

function parseTsConfig(filePath: string): TsConfigInfo | null {
  try {
    // Simple JSON parse (doesn't handle comments, but good enough for most)
    const content = fs.readFileSync(filePath, "utf-8");
    // Remove comments (basic)
    const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    const parsed = JSON.parse(cleaned);

    return {
      path: filePath,
      compilerOptions: {
        target: parsed.compilerOptions?.target || null,
        module: parsed.compilerOptions?.module || null,
        outDir: parsed.compilerOptions?.outDir || null,
        rootDir: parsed.compilerOptions?.rootDir || null,
        strict: parsed.compilerOptions?.strict ?? null,
        jsx: parsed.compilerOptions?.jsx || null,
      },
      include: parsed.include || [],
      exclude: parsed.exclude || [],
      extends: parsed.extends || null,
    };
  } catch {
    return null;
  }
}

function parseDockerfile(filePath: string): DockerConfig | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let baseImage: string | null = null;
    const exposedPorts: number[] = [];
    const stages: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim().toUpperCase();

      if (trimmed.startsWith("FROM ")) {
        const parts = line.trim().substring(5).split(/\s+/);
        if (!baseImage) {
          baseImage = parts[0];
        }
        // Check for multi-stage build
        if (parts.includes("AS") || parts.includes("as")) {
          const asIndex = parts.findIndex((p) => p.toLowerCase() === "as");
          if (asIndex >= 0 && parts[asIndex + 1]) {
            stages.push(parts[asIndex + 1]);
          }
        }
      }

      if (trimmed.startsWith("EXPOSE ")) {
        const portStr = line.trim().substring(7).split(/\s+/)[0];
        const port = parseInt(portStr, 10);
        if (!isNaN(port)) {
          exposedPorts.push(port);
        }
      }
    }

    return {
      path: filePath,
      baseImage,
      exposedPorts,
      hasMultiStage: stages.length > 0,
      stages,
    };
  } catch {
    return null;
  }
}

async function detectCIConfigs(repoPath: string): Promise<CIConfig[]> {
  const configs: CIConfig[] = [];

  // GitHub Actions
  const ghActions = await glob(".github/workflows/*.{yml,yaml}", { cwd: repoPath });
  for (const file of ghActions) {
    configs.push(await parseCIConfig(path.join(repoPath, file), "github-actions"));
  }

  // GitLab CI
  if (fs.existsSync(path.join(repoPath, ".gitlab-ci.yml"))) {
    configs.push(await parseCIConfig(path.join(repoPath, ".gitlab-ci.yml"), "gitlab-ci"));
  }

  // CircleCI
  const circleConfig = path.join(repoPath, ".circleci/config.yml");
  if (fs.existsSync(circleConfig)) {
    configs.push(await parseCIConfig(circleConfig, "circleci"));
  }

  // Travis
  if (fs.existsSync(path.join(repoPath, ".travis.yml"))) {
    configs.push(await parseCIConfig(path.join(repoPath, ".travis.yml"), "travis"));
  }

  // Jenkins
  if (fs.existsSync(path.join(repoPath, "Jenkinsfile"))) {
    configs.push({
      platform: "jenkins",
      path: "Jenkinsfile",
      triggers: [],
      jobs: [],
    });
  }

  return configs;
}

async function parseCIConfig(
  filePath: string,
  platform: CIConfig["platform"]
): Promise<CIConfig> {
  const config: CIConfig = {
    platform,
    path: filePath,
    triggers: [],
    jobs: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");

    // Extract triggers (basic parsing)
    if (platform === "github-actions") {
      const onMatch = content.match(/on:\s*\n([\s\S]*?)(?=\njobs:|$)/);
      if (onMatch) {
        const triggers = onMatch[1].match(/^\s+-?\s*(\w+)/gm);
        if (triggers) {
          config.triggers = triggers.map((t) => t.trim().replace(/^-\s*/, ""));
        }
      }
      const jobsMatch = content.match(/jobs:\s*\n([\s\S]*?)$/);
      if (jobsMatch) {
        const jobs = jobsMatch[1].match(/^\s{2}(\w+):/gm);
        if (jobs) {
          config.jobs = jobs.map((j) => j.trim().replace(":", ""));
        }
      }
    }
  } catch {
    // Parsing failed, return basic info
  }

  return config;
}

function detectEntryPoints(
  repoPath: string,
  configs: ConfigFiles,
  files: FileEntry[]
): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];

  // From package.json main
  if (configs.packageJson?.main) {
    entryPoints.push({
      path: configs.packageJson.main,
      type: "main",
      confidence: "high",
      source: "package.json#main",
    });
  }

  // From package.json bin
  if (configs.packageJson?.bin) {
    if (typeof configs.packageJson.bin === "string") {
      entryPoints.push({
        path: configs.packageJson.bin,
        type: "bin",
        confidence: "high",
        source: "package.json#bin",
      });
    } else {
      for (const [name, binPath] of Object.entries(configs.packageJson.bin)) {
        entryPoints.push({
          path: binPath,
          type: "bin",
          confidence: "high",
          source: `package.json#bin.${name}`,
        });
      }
    }
  }

  // From package.json scripts
  if (configs.packageJson?.scripts) {
    const startScript = configs.packageJson.scripts.start;
    if (startScript) {
      // Try to extract file from "node dist/index.js" or similar
      const match = startScript.match(/node\s+([^\s]+)/);
      if (match) {
        entryPoints.push({
          path: match[1],
          type: "script",
          confidence: "medium",
          source: "package.json#scripts.start",
        });
      }
    }
  }

  // Common entry point patterns
  const commonEntries = [
    { patterns: ["src/index.ts", "src/index.js"], type: "main" as const },
    { patterns: ["src/main.ts", "src/main.js"], type: "main" as const },
    { patterns: ["src/app.ts", "src/app.js"], type: "main" as const },
    { patterns: ["src/server.ts", "src/server.js"], type: "server" as const },
    { patterns: ["src/cli.ts", "src/cli.js", "bin/cli.js"], type: "cli" as const },
    { patterns: ["index.ts", "index.js"], type: "main" as const },
    { patterns: ["app.ts", "app.js"], type: "main" as const },
    { patterns: ["server.ts", "server.js"], type: "server" as const },
  ];

  for (const { patterns, type } of commonEntries) {
    for (const pattern of patterns) {
      const found = files.find((f) => f.relativePath === pattern);
      if (found && !entryPoints.some((e) => e.path === pattern)) {
        entryPoints.push({
          path: pattern,
          type,
          confidence: "medium",
          source: "convention",
        });
      }
    }
  }

  return entryPoints;
}

function analyzeDirectories(
  repoPath: string,
  files: FileEntry[]
): { path: string; fileCount: number; purpose: string | null }[] {
  const dirCounts: Record<string, number> = {};

  for (const file of files) {
    const dir = path.dirname(file.relativePath);
    const topDir = dir.split(path.sep)[0] || ".";
    dirCounts[topDir] = (dirCounts[topDir] || 0) + 1;
  }

  const purposeMap: Record<string, string> = {
    src: "source code",
    lib: "library code",
    dist: "compiled output",
    build: "build output",
    test: "tests",
    tests: "tests",
    __tests__: "tests",
    spec: "tests",
    docs: "documentation",
    doc: "documentation",
    scripts: "build/utility scripts",
    bin: "executables",
    config: "configuration",
    public: "static assets",
    static: "static assets",
    assets: "assets",
    images: "images",
    styles: "stylesheets",
    components: "UI components",
    pages: "page components",
    api: "API routes/handlers",
    routes: "routing",
    controllers: "controllers",
    models: "data models",
    services: "services",
    utils: "utilities",
    helpers: "helper functions",
    hooks: "React hooks",
    middleware: "middleware",
    types: "type definitions",
  };

  return Object.entries(dirCounts)
    .filter(([dir]) => dir !== ".")
    .map(([dir, count]) => ({
      path: dir,
      fileCount: count,
      purpose: purposeMap[dir.toLowerCase()] || null,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);
}
