#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { analyzeRepo } from "./tools/analyze-repo.js";
import { askRepo } from "./tools/ask-repo.js";
import { repoSummary } from "./tools/repo-summary.js";
import { riskReport } from "./tools/risk-report.js";
import { getSnapshot } from "./tools/get-snapshot.js";
import { getHistory, whyIsThisWeird } from "./tools/get-history.js";
import { RepoCache } from "./cache.js";

// Global cache for analyzed repos
export const repoCache = new RepoCache();

const server = new Server(
  {
    name: "repo-therapist",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_repo",
        description:
          "Analyze a repository to understand its structure, dependencies, and git history. Run this first before asking questions.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the repository to analyze",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "ask_repo",
        description:
          "Ask a question about an analyzed repository. Questions can be about structure, purpose, dependencies, patterns, or concerns.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "The question to ask about the repository (e.g., 'What does this repo do?', 'Why is the auth service structured this way?')",
            },
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: ["question"],
        },
      },
      {
        name: "repo_summary",
        description:
          "Get a high-level summary of the analyzed repository including tech stack, structure, and key components.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: [],
        },
      },
      {
        name: "risk_report",
        description:
          "Generate a risk assessment report identifying code smells, complexity hotspots, and areas that might cause problems.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: [],
        },
      },
      {
        name: "get_snapshot",
        description:
          "Get the static snapshot (ground truth) of the repository. This is the authoritative source - LLMs must cite this data, not guess. Use section parameter to get specific data.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["files", "languages", "entryPoints", "configs", "directories", "all"],
              description:
                "Which section of the snapshot to retrieve. 'all' returns a summary view.",
            },
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: [],
        },
      },
      {
        name: "get_history",
        description:
          "Get git history analysis - the time dimension. Reveals WHY code is the way it is: file churn, ownership, fragile files, hot paths vs stable core.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["churn", "authors", "fragile", "hotPaths", "timeline", "ownership", "all"],
              description:
                "Which aspect of history to retrieve: 'churn' (file change frequency), 'authors' (contributor stats), 'fragile' (problem files), 'hotPaths' (volatile vs stable), 'timeline' (events), 'ownership' (who owns what), 'all' (summary).",
            },
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: [],
        },
      },
      {
        name: "why_is_this_weird",
        description:
          "Explain why a specific file is the way it is, based on git history. Answers questions like 'Why is this file so complex?' with data: 'Because it's been rewritten 12 times by 5 different people.'",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description:
                "The relative path to the file to analyze (e.g., 'src/auth/login.ts')",
            },
            path: {
              type: "string",
              description:
                "Optional: path to repo if different from last analyzed",
            },
          },
          required: ["file_path"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "analyze_repo": {
        const path = (args as { path: string }).path;
        const result = await analyzeRepo(path);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "ask_repo": {
        const { question, path } = args as { question: string; path?: string };
        const result = await askRepo(question, path);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "repo_summary": {
        const { path } = (args as { path?: string }) || {};
        const result = await repoSummary(path);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "risk_report": {
        const { path } = (args as { path?: string }) || {};
        const result = await riskReport(path);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_snapshot": {
        const { section, path } = (args as { section?: "files" | "languages" | "entryPoints" | "configs" | "directories" | "all"; path?: string }) || {};
        const result = await getSnapshot(path, section);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_history": {
        const { section, path } = (args as { section?: "churn" | "authors" | "fragile" | "hotPaths" | "timeline" | "ownership" | "all"; path?: string }) || {};
        const result = await getHistory(path, section);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "why_is_this_weird": {
        const { file_path, path } = args as { file_path: string; path?: string };
        const result = await whyIsThisWeird(file_path, path);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Repo Therapist MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
