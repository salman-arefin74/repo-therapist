# Repo Therapist 🛋️

> Your codebase explains itself under pressure

**This MCP server is built entirely using Cursor**

Repo Therapist is an MCP (Model Context Protocol) server that turns any repository into queryable, explainable knowledge. Ask questions about your codebase through Cursor and get structured, insightful answers.

## What it does

You ask Cursor things like:
- "Why is this service structured like this?"
- "What will break if I remove this?"
- "Which parts of this repo scare you?"

Behind the scenes, Repo Therapist:
- Reads your repo structure and files
- Analyzes git history and commit patterns
- Correlates code with change frequency
- Identifies complexity hotspots and risks

## Available Tools

| Tool | Description |
|------|-------------|
| `analyze_repo(path)` | Analyze a repository - run this first |
| `get_snapshot(section?)` | Get the static snapshot (ground truth) of the repo |
| `get_history(section?)` | Get git history analysis (the time dimension) |
| `why_is_this_weird(file_path)` | Explain why a specific file is the way it is |
| `ask_repo(question)` | Ask any question about the analyzed repo |
| `repo_summary()` | Get a high-level overview |
| `risk_report()` | Generate a risk assessment report |

### Ground Truth: The Snapshot

When you run `analyze_repo`, Repo Therapist creates a **static snapshot** - the authoritative source of truth about your repository. This snapshot includes:

```json
{
  "files": [...],           // Every file with path, language, line count
  "languages": {...},       // Language breakdown with percentages
  "entryPoints": [...],     // Detected entry points with confidence levels
  "configs": {...},         // Parsed package.json, tsconfig, Dockerfile, CI configs
  "directories": [...]      // Directory structure with inferred purposes
}
```

**Why this matters:** LLMs must cite this snapshot data, not guess. When you ask "What languages does this repo use?", the answer comes from the snapshot - not from the LLM making assumptions.

Use `get_snapshot` to retrieve specific sections:
- `get_snapshot(section: "files")` - All files with metadata
- `get_snapshot(section: "languages")` - Language statistics
- `get_snapshot(section: "entryPoints")` - Detected entry points
- `get_snapshot(section: "configs")` - Parsed configuration files
- `get_snapshot(section: "directories")` - Directory structure
- `get_snapshot()` - Summary of everything

### Git Historian: The Time Dimension

The Git Historian analyzes commit history to explain **WHY** code is the way it is. This is where it stops being cute.

```json
{
  "fileChurn": { "auth.ts": { "totalCommits": 47, "churnScore": 85 } },
  "authors": { "auth.ts": ["alice", "bob", "charlie"] },
  "fragileFiles": [{ "path": "auth.ts", "reasons": ["high-churn", "many-authors"] }],
  "hotPaths": [...],
  "stableCore": [...]
}
```

**This lets you answer:**
- "Why is this weird?" → "Because it's been rewritten 12 times in 6 months."
- "Who owns this file?" → "Disputed - 4 people have modified it, none with >30%."
- "What should I be careful with?" → "These 5 files are fragile and bug-prone."

Use `get_history` to retrieve specific aspects:
- `get_history(section: "churn")` - File change frequency and volatility
- `get_history(section: "authors")` - Contributor statistics
- `get_history(section: "fragile")` - Files likely to cause problems
- `get_history(section: "hotPaths")` - Hot paths vs stable core
- `get_history(section: "timeline")` - Key events and commit patterns
- `get_history(section: "ownership")` - Who owns what
- `get_history()` - Summary of everything

Use `why_is_this_weird` for specific file analysis:
```
Use why_is_this_weird on "src/auth/login.ts"
```

Returns a detailed explanation with citations:
```
# Why is "src/auth/login.ts" the way it is?

## Change History
- Total commits: 47
- Authors: 5 (alice, bob, charlie, dave, eve)
- Churn score: 85 ⚠️ HIGH

## 🔍 Why It's Unusual
**Heavily modified:** This file has been changed 47 times...
**Many hands:** 5 different people have modified this file...
```

## Setup

### 1. Install dependencies

```bash
cd repo-therapist
npm install
```

### 2. Build the project

```bash
npm run build
```

### 3. Add to Cursor

Open Cursor Settings → MCP → Add new MCP server:

```json
{
  "mcpServers": {
    "repo-therapist": {
      "command": "node",
      "args": ["/FULL/PATH/TO/repo-therapist/dist/index.js"]
    }
  }
}
```

**Important:** Replace `/FULL/PATH/TO/` with the actual absolute path to your repo-therapist folder.

Example:
```json
{
  "mcpServers": {
    "repo-therapist": {
      "command": "node",
      "args": ["/Users/saar/Projects/private/repo-therapist/dist/index.js"]
    }
  }
}
```

### 4. Restart Cursor

After adding the MCP config, restart Cursor for changes to take effect.

## FAQ

### Do I need to run repo-therapist separately?

**No.** Cursor automatically starts and manages the MCP server for you. When you add the config to Cursor's MCP settings, Cursor will:
- Start the `node dist/index.js` process when needed
- Keep it running in the background
- Communicate with it via stdio (standard input/output)

You just need to build once (`npm run build`), add the config, and restart Cursor. That's it.

### Where do I ask questions?

**In the normal Cursor chat** (Cmd+L or the chat panel). The difference is *how* you ask:

- **Without MCP:** "What does this repo do?" → Cursor uses its built-in tools
- **With Repo Therapist:** "Use `analyze_repo` on `/path/to/repo`" → Cursor calls the MCP tool

You explicitly tell Cursor to use the repo-therapist tools. Cursor sees them as additional capabilities it can use.

### What's the difference vs normal Cursor chat?

| Normal Cursor Chat | With Repo Therapist |
|-------------------|---------------------|
| Reads files on demand | Pre-analyzes entire repo structure |
| No git history awareness | Analyzes commit patterns & churn |
| Answers based on what it reads | Answers based on structured analysis |
| No risk detection | Identifies complexity hotspots |
| Generic code understanding | Domain-specific insights ("what scares you?") |

**The key difference:** Repo Therapist does *structured analysis* upfront and stores it, so questions like "which files change most often?" or "what are the risks?" can be answered from pre-computed data rather than Cursor having to figure it out each time.

Think of it as: Cursor is smart but reactive. Repo Therapist gives it a "briefing document" about your codebase that it can reference.

## Usage

Once configured, you can use Repo Therapist in Cursor chat:

### Step 1: Analyze a repo

First, analyze the repository you want to explore:

```
Use analyze_repo to analyze /path/to/some/repo
```

### Step 2: Ask questions

Now you can ask questions:

```
Use ask_repo to answer: "What does this repo do?"
```

```
Use ask_repo to answer: "Which parts of this repo scare you?"
```

```
Use ask_repo to answer: "What will break if I remove the auth module?"
```

### Step 3: Get reports

Get a summary:
```
Use repo_summary to show me an overview
```

Get a risk assessment:
```
Use risk_report to identify potential issues
```

## Example Questions

- "What does this repo do?"
- "How is the code structured?"
- "What tech stack is being used?"
- "Show me the dependencies"
- "Which files are the largest?"
- "What files change most often?"
- "Who are the contributors?"
- "What are the recent commits?"
- "Which parts scare you?"
- "What will break if I change X?"

## Development

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Run tests

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Testing Guidelines

> **Note:** Always add unit tests when implementing new features.

Tests are located in `tests/` and use [Vitest](https://vitest.dev/). The test structure mirrors the source:

```
tests/
├── fixtures/           # Test utilities and mock repos
│   └── setup.ts        # Helper functions for creating test repos
├── scanner/            # Scanner module tests
├── historian/          # Historian module tests
├── tools/              # Tool tests
└── cache.test.ts       # Cache tests
```

When adding a new feature:
1. Create tests in the appropriate `tests/` subdirectory
2. Use `createTestRepo()` from `fixtures/setup.ts` for git-related tests
3. Clean up test repos with `cleanupTestRepo()` in `afterAll`
4. Run `npm test` to verify all tests pass before committing

### Project structure

```
repo-therapist/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── cache.ts              # In-memory repo cache
│   ├── types.ts              # TypeScript interfaces
│   ├── scanner/              # Static snapshot engine (Step 2)
│   │   ├── index.ts          # Scanner exports
│   │   ├── types.ts          # Snapshot type definitions
│   │   └── scan-repo.ts      # Repository scanner
│   ├── historian/            # Git history analyzer (Step 3)
│   │   ├── index.ts          # Historian exports
│   │   ├── types.ts          # History type definitions
│   │   └── analyze-history.ts # Git history analysis
│   └── tools/
│       ├── analyze-repo.ts   # Repository analyzer (orchestrates all)
│       ├── get-snapshot.ts   # Snapshot retrieval (ground truth)
│       ├── get-history.ts    # History retrieval (time dimension)
│       ├── ask-repo.ts       # Question answering
│       ├── repo-summary.ts   # Summary generator
│       └── risk-report.ts    # Risk assessment
├── tests/                    # Unit tests
│   ├── fixtures/             # Test utilities
│   ├── scanner/              # Scanner tests
│   ├── historian/            # Historian tests
│   └── tools/                # Tool tests
├── package.json
├── tsconfig.json
├── vitest.config.ts          # Test configuration
└── README.md
```

## Tech Stack

- **TypeScript** - Type-safe codebase
- **@modelcontextprotocol/sdk** - MCP server implementation
- **simple-git** - Git history analysis
- **ts-morph** - TypeScript/JavaScript AST parsing (planned)
- **glob** - File pattern matching

## Roadmap

- [ ] AST-based code analysis with ts-morph
- [ ] Persist analysis to JSON/SQLite
- [ ] Dependency graph visualization
- [ ] Security vulnerability detection
- [ ] Test coverage analysis
- [ ] Custom question handlers

## License

MIT
