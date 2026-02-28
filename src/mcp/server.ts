import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StudyDatabase } from "./db.js";

// Resolve zod from the MCP SDK's dependency context since it is a peer
// dependency that pnpm does not hoist to the project root.
const require = createRequire(
  import.meta.resolve("@modelcontextprotocol/sdk/server/mcp.js")
);
const { z } = require("zod") as { z: typeof import("zod").z };

interface ToolDefinition {
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export function createMcpServer(db: StudyDatabase) {
  const tools = new Map<string, ToolDefinition>();

  /** Resolves cert_id or exam_code to the canonical cert_id. */
  function resolve(certId: string | undefined): string | undefined {
    return certId ? db.resolveCertId(certId) : undefined;
  }

  tools.set("list_certs", {
    description: "List all available certifications with their IDs, names, and exam codes. Call this first to discover valid cert_id values for other tools.",
    schema: {},
    handler: () => {
      return { certifications: db.listCerts() };
    },
  });

  tools.set("get_objectives", {
    description: "Get study objectives for a certification, optionally filtered by domain. cert_id can be the internal ID (e.g. 'comptia-aplus-1201') or exam code (e.g. '220-1201').",
    schema: {
      cert_id: z.string(),
      domain: z.number().optional(),
    },
    handler: (args) => {
      const objectives = db.getObjectives(
        resolve(args.cert_id as string)!,
        args.domain as number | undefined
      );
      return { objectives };
    },
  });

  tools.set("get_exam_info", {
    description: "Get exam information for a certification including domains. cert_id can be the internal ID or exam code.",
    schema: {
      cert_id: z.string(),
    },
    handler: (args) => {
      return db.getExamInfo(resolve(args.cert_id as string)!);
    },
  });

  tools.set("get_mastery_summary", {
    description: "Get mastery summary across objectives, optionally filtered by cert. cert_id can be the internal ID or exam code.",
    schema: {
      cert_id: z.string().optional(),
    },
    handler: (args) => {
      return { mastery: db.getMasterySummary(resolve(args.cert_id as string | undefined)) };
    },
  });

  tools.set("get_weak_areas", {
    description: "Get weak areas sorted by lowest mastery, optionally filtered by cert. cert_id can be the internal ID or exam code.",
    schema: {
      cert_id: z.string().optional(),
      limit: z.number().optional(),
    },
    handler: (args) => {
      return {
        weak_areas: db.getWeakAreas(
          resolve(args.cert_id as string | undefined),
          args.limit as number | undefined
        ),
      };
    },
  });

  tools.set("record_answer", {
    description: "Record an answer for a study objective. cert_id can be the internal ID or exam code. objective_id should be the full ID (e.g. 'aplus-1201-2.1').",
    schema: {
      cert_id: z.string(),
      objective_id: z.string(),
      correct: z.boolean(),
      difficulty: z.enum(["easy", "medium", "hard"]),
    },
    handler: (args) => {
      db.recordAnswer(
        resolve(args.cert_id as string)!,
        args.objective_id as string,
        args.correct as boolean,
        args.difficulty as "easy" | "medium" | "hard"
      );
      return { recorded: true };
    },
  });

  tools.set("start_session", {
    description: "Start a new study session for a certification. cert_id can be the internal ID or exam code.",
    schema: {
      cert_id: z.string(),
    },
    handler: (args) => {
      return { session_id: db.startSession(resolve(args.cert_id as string)!) };
    },
  });

  tools.set("end_session", {
    description: "End an active study session with summary data",
    schema: {
      session_id: z.number(),
      summary: z.string(),
      topics_covered: z.array(z.string()).optional(),
      questions_asked: z.number().optional(),
      questions_correct: z.number().optional(),
      weak_areas_identified: z.array(z.string()).optional(),
    },
    handler: (args) => {
      db.endSession(args.session_id as number, {
        summary: args.summary as string,
        topics_covered: (args.topics_covered as string[] | undefined) ?? [],
        questions_asked: (args.questions_asked as number | undefined) ?? 0,
        questions_correct: (args.questions_correct as number | undefined) ?? 0,
        weak_areas_identified:
          (args.weak_areas_identified as string[] | undefined) ?? [],
      });
      return { ended: true };
    },
  });

  tools.set("get_session_history", {
    description: "Get study session history, optionally filtered by cert. cert_id can be the internal ID or exam code.",
    schema: {
      cert_id: z.string().optional(),
      limit: z.number().optional(),
    },
    handler: (args) => {
      return {
        sessions: db.getSessionHistory(
          resolve(args.cert_id as string | undefined),
          args.limit as number | undefined
        ),
      };
    },
  });

  return {
    getToolNames(): string[] {
      return Array.from(tools.keys());
    },

    async callTool(
      name: string,
      args: Record<string, unknown>
    ): Promise<unknown> {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return await Promise.resolve(tool.handler(args));
    },

    buildMcpServer(): McpServer {
      const mcpServer = new McpServer({
        name: "ai-study-agent",
        version: "0.1.0",
      });

      for (const [name, tool] of tools) {
        mcpServer.tool(name, tool.description, tool.schema, async (args) => {
          const result = await Promise.resolve(tool.handler(args));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result),
              },
            ],
          };
        });
      }

      return mcpServer;
    },
  };
}

// Standalone entry point: run when this file is executed directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("/server.ts") ||
    process.argv[1].endsWith("/server.js"));

if (isMainModule) {
  const db = new StudyDatabase(process.env.STUDY_DB_PATH ?? "data/study.db");
  const server = createMcpServer(db);
  const mcpServer = server.buildMcpServer();
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).catch((err: unknown) => {
    console.error("Failed to connect MCP server:", err);
    process.exit(1);
  });
}
