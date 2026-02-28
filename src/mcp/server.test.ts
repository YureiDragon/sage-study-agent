import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StudyDatabase } from "./db.js";
import { createMcpServer } from "./server.js";
import type { CertDefinition } from "../shared/types.js";

/** Type-safe wrapper around callTool. */
async function call<T>(
  server: ReturnType<typeof createMcpServer>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return (await server.callTool(name, args)) as T;
}

function makeCert(overrides: Partial<CertDefinition> = {}): CertDefinition {
  return {
    id: "aws-saa-c03",
    name: "AWS Solutions Architect Associate",
    exam_code: "SAA-C03",
    passing_score: 720,
    max_score: 1000,
    time_minutes: 130,
    question_count: 65,
    domains: [
      { number: 1, name: "Secure Architectures", weight: 30 },
      { number: 2, name: "Resilient Architectures", weight: 26 },
      { number: 3, name: "High-Performing Architectures", weight: 24 },
      { number: 4, name: "Cost-Optimized Architectures", weight: 20 },
    ],
    objectives: [
      {
        id: "saa-1.1",
        domain: 1,
        title: "Design secure access to AWS resources",
        subtopics: ["IAM policies", "Resource-based policies", "S3 access"],
      },
      {
        id: "saa-1.2",
        domain: 1,
        title: "Design secure workloads and applications",
        subtopics: ["Encryption", "Secrets management"],
      },
      {
        id: "saa-2.1",
        domain: 2,
        title: "Design scalable and loosely coupled architectures",
        subtopics: ["SQS", "SNS", "API Gateway"],
      },
      {
        id: "saa-3.1",
        domain: 3,
        title: "Determine high-performing storage solutions",
        subtopics: ["EBS", "S3", "EFS"],
      },
    ],
    ...overrides,
  };
}

describe("MCP Server", () => {
  let db: StudyDatabase;
  let server: ReturnType<typeof createMcpServer>;

  beforeEach(() => {
    db = new StudyDatabase(":memory:");
    db.importCert(makeCert());
    server = createMcpServer(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("getToolNames", () => {
    it("should list all 9 tool names", () => {
      const names = server.getToolNames();
      expect(names).toHaveLength(9);
      expect(names).toContain("list_certs");
      expect(names).toContain("get_objectives");
      expect(names).toContain("get_exam_info");
      expect(names).toContain("get_mastery_summary");
      expect(names).toContain("get_weak_areas");
      expect(names).toContain("record_answer");
      expect(names).toContain("start_session");
      expect(names).toContain("end_session");
      expect(names).toContain("get_session_history");
    });
  });

  describe("get_objectives", () => {
    it("should return objectives for a cert", async () => {
      const result = await call<{ objectives: { title: string }[] }>(
        server, "get_objectives", { cert_id: "aws-saa-c03" },
      );
      expect(result.objectives).toHaveLength(4);
      expect(result.objectives[0].title).toBe(
        "Design secure access to AWS resources"
      );
    });

    it("should filter by domain when provided", async () => {
      const result = await call<{ objectives: unknown[] }>(
        server, "get_objectives", { cert_id: "aws-saa-c03", domain: 1 },
      );
      expect(result.objectives).toHaveLength(2);
    });
  });

  describe("get_exam_info", () => {
    it("should return cert details with domains", async () => {
      const result = await call<{
        id: string; name: string; exam_code: string;
        domains: { name: string }[];
      }>(server, "get_exam_info", { cert_id: "aws-saa-c03" });
      expect(result).toBeDefined();
      expect(result.id).toBe("aws-saa-c03");
      expect(result.name).toBe("AWS Solutions Architect Associate");
      expect(result.exam_code).toBe("SAA-C03");
      expect(result.domains).toHaveLength(4);
      expect(result.domains[0].name).toBe("Secure Architectures");
    });
  });

  describe("record_answer + get_mastery_summary", () => {
    it("should record an answer and reflect it in mastery summary", async () => {
      const recordResult = await call<{ recorded: boolean }>(
        server, "record_answer", {
          cert_id: "aws-saa-c03", objective_id: "saa-1.1",
          correct: true, difficulty: "medium",
        },
      );
      expect(recordResult).toEqual({ recorded: true });

      await call(server, "record_answer", {
        cert_id: "aws-saa-c03", objective_id: "saa-1.1",
        correct: false, difficulty: "hard",
      });

      const masteryResult = await call<{
        mastery: { objective_id: string; mastery_percentage: number }[];
      }>(server, "get_mastery_summary", { cert_id: "aws-saa-c03" });
      expect(masteryResult.mastery).toHaveLength(1);
      expect(masteryResult.mastery[0].objective_id).toBe("saa-1.1");
      expect(masteryResult.mastery[0].mastery_percentage).toBe(50);
    });

    it("should return mastery for all certs when cert_id is omitted", async () => {
      await call(server, "record_answer", {
        cert_id: "aws-saa-c03", objective_id: "saa-1.1",
        correct: true, difficulty: "easy",
      });

      const result = await call<{ mastery: unknown[] }>(
        server, "get_mastery_summary", {},
      );
      expect(result.mastery.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("get_weak_areas", () => {
    it("should return weak areas sorted by lowest mastery", async () => {
      await call(server, "record_answer", {
        cert_id: "aws-saa-c03", objective_id: "saa-1.1",
        correct: false, difficulty: "medium",
      });
      await call(server, "record_answer", {
        cert_id: "aws-saa-c03", objective_id: "saa-2.1",
        correct: true, difficulty: "easy",
      });

      const result = await call<{
        weak_areas: { objective_id: string }[];
      }>(server, "get_weak_areas", { cert_id: "aws-saa-c03" });
      expect(result.weak_areas).toHaveLength(2);
      // saa-1.1 is 0% (all wrong), saa-2.1 is 100% (all correct)
      expect(result.weak_areas[0].objective_id).toBe("saa-1.1");
    });
  });

  describe("Session lifecycle", () => {
    it("should start, end, and retrieve session history", async () => {
      const startResult = await call<{ session_id: number }>(
        server, "start_session", { cert_id: "aws-saa-c03" },
      );
      expect(startResult.session_id).toBeGreaterThan(0);

      const sessionId = startResult.session_id;

      const endResult = await call<{ ended: boolean }>(
        server, "end_session", {
          session_id: sessionId,
          summary: "Covered IAM and S3 topics",
          topics_covered: ["IAM", "S3"],
          questions_asked: 10,
          questions_correct: 7,
          weak_areas_identified: ["saa-1.1"],
        },
      );
      expect(endResult).toEqual({ ended: true });

      const historyResult = await call<{
        sessions: {
          id: number; summary: string;
          topics_covered: string[]; questions_asked: number;
          questions_correct: number; weak_areas_identified: string[];
        }[];
      }>(server, "get_session_history", { cert_id: "aws-saa-c03" });
      expect(historyResult.sessions).toHaveLength(1);
      expect(historyResult.sessions[0].id).toBe(sessionId);
      expect(historyResult.sessions[0].summary).toBe(
        "Covered IAM and S3 topics"
      );
      expect(historyResult.sessions[0].topics_covered).toEqual(["IAM", "S3"]);
      expect(historyResult.sessions[0].questions_asked).toBe(10);
      expect(historyResult.sessions[0].questions_correct).toBe(7);
      expect(historyResult.sessions[0].weak_areas_identified).toEqual([
        "saa-1.1",
      ]);
    });

    it("should return history for all certs when cert_id is omitted", async () => {
      await call(server, "start_session", { cert_id: "aws-saa-c03" });

      const result = await call<{ sessions: unknown[] }>(
        server, "get_session_history", {},
      );
      expect(result.sessions).toHaveLength(1);
    });
  });

  describe("buildMcpServer", () => {
    it("should return an McpServer instance", () => {
      const mcpServer = server.buildMcpServer();
      expect(mcpServer).toBeDefined();
      expect(typeof mcpServer.connect).toBe("function");
      expect(typeof mcpServer.close).toBe("function");
    });
  });
});
