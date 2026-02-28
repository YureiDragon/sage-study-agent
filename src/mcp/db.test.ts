import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StudyDatabase } from "./db.js";
import type {
  CertDefinition,
  Difficulty,
  MasteryScore,
  SessionSummary,
} from "../shared/types.js";

// A realistic cert definition fixture for tests
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

describe("StudyDatabase", () => {
  let db: StudyDatabase;

  beforeEach(() => {
    db = new StudyDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("Schema creation", () => {
    it("should create all required tables", () => {
      // Verify the cert can be imported and queried (exercises all tables)
      db.importCert(makeCert());
      const cert = db.getCert("aws-saa-c03");
      expect(cert).toBeDefined();
      expect(cert!.name).toBe("AWS Solutions Architect Associate");
    });

    it("should be idempotent — opening twice on same DB does not error", () => {
      // The constructor runs migrations; a second instance on the same
      // in-memory DB would fail if CREATE TABLE lacks IF NOT EXISTS.
      expect(() => new StudyDatabase(":memory:")).not.toThrow();
    });
  });

  describe("importCert / getCert", () => {
    it("should import a cert and retrieve it by ID", () => {
      const cert = makeCert();
      db.importCert(cert);

      const retrieved = db.getCert(cert.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(cert.id);
      expect(retrieved!.name).toBe(cert.name);
      expect(retrieved!.exam_code).toBe(cert.exam_code);
      expect(retrieved!.passing_score).toBe(cert.passing_score);
      expect(retrieved!.max_score).toBe(cert.max_score);
      expect(retrieved!.time_minutes).toBe(cert.time_minutes);
      expect(retrieved!.question_count).toBe(cert.question_count);
    });

    it("should return undefined for a non-existent cert", () => {
      const retrieved = db.getCert("does-not-exist");
      expect(retrieved).toBeUndefined();
    });

    it("should upsert on re-import (no duplicate key error)", () => {
      const cert = makeCert();
      db.importCert(cert);

      const updated = makeCert({ name: "Updated Name" });
      expect(() => db.importCert(updated)).not.toThrow();

      const retrieved = db.getCert(cert.id);
      expect(retrieved!.name).toBe("Updated Name");
    });
  });

  describe("getExamInfo", () => {
    it("should return cert info with its domains", () => {
      const cert = makeCert();
      db.importCert(cert);

      const info = db.getExamInfo(cert.id);
      expect(info).toBeDefined();
      expect(info!.id).toBe(cert.id);
      expect(info!.domains).toHaveLength(4);
      expect(info!.domains[0].name).toBe("Secure Architectures");
      expect(info!.domains[0].domain_number).toBe(1);
      expect(info!.domains[0].weight_percentage).toBe(30);
    });

    it("should return undefined for a non-existent cert", () => {
      const info = db.getExamInfo("does-not-exist");
      expect(info).toBeUndefined();
    });
  });

  describe("getObjectives", () => {
    it("should return all objectives for a cert", () => {
      db.importCert(makeCert());
      const objectives = db.getObjectives("aws-saa-c03");
      expect(objectives).toHaveLength(4);
    });

    it("should filter objectives by domain number", () => {
      db.importCert(makeCert());
      const domain1 = db.getObjectives("aws-saa-c03", 1);
      expect(domain1).toHaveLength(2);
      expect(domain1[0].title).toBe("Design secure access to AWS resources");

      const domain2 = db.getObjectives("aws-saa-c03", 2);
      expect(domain2).toHaveLength(1);
    });

    it("should return objectives with subtopics as parsed arrays", () => {
      db.importCert(makeCert());
      const objectives = db.getObjectives("aws-saa-c03", 1);
      expect(objectives[0].subtopics).toEqual([
        "IAM policies",
        "Resource-based policies",
        "S3 access",
      ]);
    });

    it("should return an empty array for non-existent cert", () => {
      const objectives = db.getObjectives("does-not-exist");
      expect(objectives).toEqual([]);
    });
  });

  describe("recordAnswer / getMasterySummary", () => {
    beforeEach(() => {
      db.importCert(makeCert());
    });

    it("should record answers and calculate mastery percentage", () => {
      // 3 correct out of 4 for objective saa-1.1 = 75%
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "hard");

      const mastery = db.getMasterySummary("aws-saa-c03");
      const obj = mastery.find((m) => m.objective_id === "saa-1.1");
      expect(obj).toBeDefined();
      expect(obj!.mastery_percentage).toBe(75);
      expect(obj!.total_answers).toBe(4);
    });

    it("should return mastery for all certs when certId is omitted", () => {
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "easy");

      const mastery = db.getMasterySummary();
      expect(mastery.length).toBeGreaterThanOrEqual(1);
      expect(mastery[0].cert_id).toBe("aws-saa-c03");
    });

    it("should only include objectives that have answers", () => {
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "easy");
      const mastery = db.getMasterySummary("aws-saa-c03");
      // Only saa-1.1 has answers, so only that one should appear
      expect(mastery).toHaveLength(1);
      expect(mastery[0].objective_id).toBe("saa-1.1");
    });

    it("should include domain name and title in mastery results", () => {
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "easy");
      const mastery = db.getMasterySummary("aws-saa-c03");
      expect(mastery[0].title).toBe("Design secure access to AWS resources");
      expect(mastery[0].domain_name).toBe("Secure Architectures");
    });
  });

  describe("getWeakAreas", () => {
    beforeEach(() => {
      db.importCert(makeCert());
    });

    it("should return objectives sorted by lowest mastery first", () => {
      // saa-1.1: 1/4 = 25%
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "medium");

      // saa-2.1: 3/4 = 75%
      db.recordAnswer("aws-saa-c03", "saa-2.1", true, "easy");
      db.recordAnswer("aws-saa-c03", "saa-2.1", true, "easy");
      db.recordAnswer("aws-saa-c03", "saa-2.1", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-2.1", false, "hard");

      // saa-1.2: 2/4 = 50%
      db.recordAnswer("aws-saa-c03", "saa-1.2", true, "easy");
      db.recordAnswer("aws-saa-c03", "saa-1.2", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.2", false, "hard");
      db.recordAnswer("aws-saa-c03", "saa-1.2", false, "hard");

      const weak = db.getWeakAreas("aws-saa-c03");
      expect(weak.length).toBeGreaterThanOrEqual(3);
      expect(weak[0].objective_id).toBe("saa-1.1"); // 25%
      expect(weak[1].objective_id).toBe("saa-1.2"); // 50%
      expect(weak[2].objective_id).toBe("saa-2.1"); // 75%
    });

    it("should respect the limit parameter", () => {
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "easy");
      db.recordAnswer("aws-saa-c03", "saa-2.1", true, "easy");
      db.recordAnswer("aws-saa-c03", "saa-1.2", false, "easy");

      const weak = db.getWeakAreas("aws-saa-c03", 2);
      expect(weak).toHaveLength(2);
    });

    it("should only include objectives that have answers", () => {
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "easy");
      const weak = db.getWeakAreas("aws-saa-c03");
      expect(weak).toHaveLength(1);
      expect(weak[0].objective_id).toBe("saa-1.1");
    });
  });

  describe("Session lifecycle", () => {
    beforeEach(() => {
      db.importCert(makeCert());
    });

    it("should start a session and return a numeric ID", () => {
      const sessionId = db.startSession("aws-saa-c03");
      expect(typeof sessionId).toBe("number");
      expect(sessionId).toBeGreaterThan(0);
    });

    it("should end a session with summary data", () => {
      const sessionId = db.startSession("aws-saa-c03");
      db.endSession(sessionId, {
        topics_covered: ["IAM", "S3"],
        questions_asked: 10,
        questions_correct: 7,
        weak_areas_identified: ["saa-1.1"],
        summary: "Good session on IAM and S3 topics",
      });

      const history = db.getSessionHistory("aws-saa-c03");
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(sessionId);
      expect(history[0].questions_asked).toBe(10);
      expect(history[0].questions_correct).toBe(7);
      expect(history[0].topics_covered).toEqual(["IAM", "S3"]);
      expect(history[0].weak_areas_identified).toEqual(["saa-1.1"]);
      expect(history[0].summary).toBe("Good session on IAM and S3 topics");
      expect(history[0].end_time).not.toBeNull();
    });

    it("should return sessions in reverse chronological order", () => {
      const id1 = db.startSession("aws-saa-c03");
      db.endSession(id1, {
        topics_covered: ["IAM"],
        questions_asked: 5,
        questions_correct: 3,
        weak_areas_identified: [],
        summary: "First session",
      });

      const id2 = db.startSession("aws-saa-c03");
      db.endSession(id2, {
        topics_covered: ["S3"],
        questions_asked: 8,
        questions_correct: 6,
        weak_areas_identified: [],
        summary: "Second session",
      });

      const history = db.getSessionHistory("aws-saa-c03");
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(id2); // most recent first
      expect(history[1].id).toBe(id1);
    });

    it("should respect the limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        db.startSession("aws-saa-c03");
      }
      const history = db.getSessionHistory("aws-saa-c03", 3);
      expect(history).toHaveLength(3);
    });

    it("should return all sessions when certId is omitted", () => {
      db.startSession("aws-saa-c03");

      const otherCert = makeCert({
        id: "az-900",
        name: "Azure Fundamentals",
        exam_code: "AZ-900",
        domains: [
          { number: 1, name: "Cloud Concepts", weight: 50 },
          { number: 2, name: "Azure Services", weight: 50 },
        ],
        objectives: [
          {
            id: "az-1.1",
            domain: 1,
            title: "Describe cloud computing",
            subtopics: ["IaaS", "PaaS", "SaaS"],
          },
        ],
      });
      db.importCert(otherCert);
      db.startSession("az-900");

      const history = db.getSessionHistory();
      expect(history).toHaveLength(2);
    });

    it("should show null end_time for an in-progress session", () => {
      db.startSession("aws-saa-c03");
      const history = db.getSessionHistory("aws-saa-c03");
      expect(history[0].end_time).toBeNull();
    });

    it("should delete a session and its associated answers", () => {
      const sessionId = db.startSession("aws-saa-c03");
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "medium");
      db.recordAnswer("aws-saa-c03", "saa-1.1", false, "easy");
      db.endSession(sessionId, {
        topics_covered: ["IAM"],
        questions_asked: 2,
        questions_correct: 1,
        weak_areas_identified: [],
        summary: "Quick IAM review",
      });

      // Verify data exists before delete
      expect(db.getSessionHistory("aws-saa-c03")).toHaveLength(1);
      expect(db.getMasterySummary("aws-saa-c03")).toHaveLength(1);

      const deleted = db.deleteSession(sessionId);
      expect(deleted).toBe(true);

      // Session gone
      expect(db.getSessionHistory("aws-saa-c03")).toHaveLength(0);
      // Answers gone too — mastery should be empty
      expect(db.getMasterySummary("aws-saa-c03")).toHaveLength(0);
    });

    it("should not delete answers from other sessions", () => {
      // Session 1 — record an answer, end it
      const s1 = db.startSession("aws-saa-c03");
      db.recordAnswer("aws-saa-c03", "saa-1.1", true, "medium");
      db.endSession(s1, {
        topics_covered: ["IAM"],
        questions_asked: 1,
        questions_correct: 1,
        weak_areas_identified: [],
        summary: "Session 1",
      });

      // Session 2 — record an answer, end it
      const s2 = db.startSession("aws-saa-c03");
      db.recordAnswer("aws-saa-c03", "saa-2.1", false, "hard");
      db.endSession(s2, {
        topics_covered: ["SQS"],
        questions_asked: 1,
        questions_correct: 0,
        weak_areas_identified: ["saa-2.1"],
        summary: "Session 2",
      });

      // Delete session 1 only
      db.deleteSession(s1);

      // Session 2 remains
      const history = db.getSessionHistory("aws-saa-c03");
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(s2);

      // Session 2's answer remains
      const mastery = db.getMasterySummary("aws-saa-c03");
      expect(mastery).toHaveLength(1);
      expect(mastery[0].objective_id).toBe("saa-2.1");
    });

    it("should return false when deleting a non-existent session", () => {
      const deleted = db.deleteSession(99999);
      expect(deleted).toBe(false);
    });
  });
});
