import Database from "better-sqlite3";
import type {
  CertDefinition,
  Difficulty,
  MasteryScore,
  SessionSummary,
} from "../shared/types.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exam_code TEXT NOT NULL,
  passing_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  time_minutes INTEGER NOT NULL,
  question_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_id TEXT NOT NULL REFERENCES certifications(id),
  domain_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  weight_percentage REAL NOT NULL,
  UNIQUE(cert_id, domain_number)
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  cert_id TEXT NOT NULL REFERENCES certifications(id),
  domain_id INTEGER NOT NULL REFERENCES domains(id),
  objective_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtopics TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_id TEXT NOT NULL REFERENCES certifications(id),
  objective_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  session_id INTEGER REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_id TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT (datetime('now')),
  end_time TEXT,
  topics_covered TEXT NOT NULL DEFAULT '[]',
  questions_asked INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  weak_areas_identified TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT ''
);
`;

export class StudyDatabase {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
    this.migrate();
  }

  /**
   * Run lightweight migrations for columns added after initial schema.
   */
  private migrate(): void {
    // Add session_id to answers if it doesn't exist yet (added for deleteSession support)
    const cols = this.db
      .prepare("PRAGMA table_info(answers)")
      .all() as { name: string }[];
    if (!cols.some((c) => c.name === "session_id")) {
      this.db.exec("ALTER TABLE answers ADD COLUMN session_id INTEGER REFERENCES sessions(id)");
    }
  }

  /**
   * Lists all available certifications with their IDs and exam codes.
   */
  listCerts(): { id: string; name: string; exam_code: string }[] {
    return this.db
      .prepare("SELECT id, name, exam_code FROM certifications ORDER BY name")
      .all() as { id: string; name: string; exam_code: string }[];
  }

  /**
   * Resolves a cert identifier that might be an exam_code (e.g. "220-1201")
   * to the actual cert_id (e.g. "comptia-aplus-1201"). Returns the input
   * unchanged if it already matches a cert_id or no match is found.
   */
  resolveCertId(input: string): string {
    // Check if it's already a valid cert_id
    const direct = this.db
      .prepare("SELECT id FROM certifications WHERE id = ?")
      .get(input) as { id: string } | undefined;
    if (direct) return direct.id;

    // Try matching by exam_code
    const byCode = this.db
      .prepare("SELECT id FROM certifications WHERE exam_code = ?")
      .get(input) as { id: string } | undefined;
    if (byCode) return byCode.id;

    return input;
  }

  importCert(cert: CertDefinition): void {
    const txn = this.db.transaction(() => {
      // Upsert certification
      this.db
        .prepare(
          `INSERT INTO certifications (id, name, exam_code, passing_score, max_score, time_minutes, question_count)
           VALUES (@id, @name, @exam_code, @passing_score, @max_score, @time_minutes, @question_count)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             exam_code = excluded.exam_code,
             passing_score = excluded.passing_score,
             max_score = excluded.max_score,
             time_minutes = excluded.time_minutes,
             question_count = excluded.question_count`
        )
        .run({
          id: cert.id,
          name: cert.name,
          exam_code: cert.exam_code,
          passing_score: cert.passing_score,
          max_score: cert.max_score,
          time_minutes: cert.time_minutes,
          question_count: cert.question_count,
        });

      // Remove old domains and objectives for this cert so we can re-import cleanly
      this.db
        .prepare("DELETE FROM objectives WHERE cert_id = ?")
        .run(cert.id);
      this.db
        .prepare("DELETE FROM domains WHERE cert_id = ?")
        .run(cert.id);

      // Insert domains
      const insertDomain = this.db.prepare(
        `INSERT INTO domains (cert_id, domain_number, name, weight_percentage)
         VALUES (@cert_id, @domain_number, @name, @weight_percentage)`
      );

      for (const domain of cert.domains) {
        insertDomain.run({
          cert_id: cert.id,
          domain_number: domain.number,
          name: domain.name,
          weight_percentage: domain.weight,
        });
      }

      // Insert objectives
      const insertObjective = this.db.prepare(
        `INSERT INTO objectives (id, cert_id, domain_id, objective_id, title, subtopics)
         VALUES (@id, @cert_id, @domain_id, @objective_id, @title, @subtopics)`
      );

      for (const obj of cert.objectives) {
        // Look up domain_id from the domain number
        const domain = this.db
          .prepare(
            "SELECT id FROM domains WHERE cert_id = ? AND domain_number = ?"
          )
          .get(cert.id, obj.domain) as { id: number } | undefined;

        if (!domain) {
          throw new Error(
            `Domain number ${obj.domain} not found for cert ${cert.id}`
          );
        }

        insertObjective.run({
          id: obj.id,
          cert_id: cert.id,
          domain_id: domain.id,
          objective_id: obj.id,
          title: obj.title,
          subtopics: JSON.stringify(obj.subtopics),
        });
      }
    });

    txn();
  }

  getCert(
    certId: string
  ):
    | {
        id: string;
        name: string;
        exam_code: string;
        passing_score: number;
        max_score: number;
        time_minutes: number;
        question_count: number;
      }
    | undefined {
    return this.db
      .prepare("SELECT * FROM certifications WHERE id = ?")
      .get(certId) as
      | {
          id: string;
          name: string;
          exam_code: string;
          passing_score: number;
          max_score: number;
          time_minutes: number;
          question_count: number;
        }
      | undefined;
  }

  getExamInfo(
    certId: string
  ):
    | {
        id: string;
        name: string;
        exam_code: string;
        passing_score: number;
        max_score: number;
        time_minutes: number;
        question_count: number;
        domains: {
          id: number;
          domain_number: number;
          name: string;
          weight_percentage: number;
        }[];
      }
    | undefined {
    const cert = this.getCert(certId);
    if (!cert) return undefined;

    const domains = this.db
      .prepare(
        "SELECT id, domain_number, name, weight_percentage FROM domains WHERE cert_id = ? ORDER BY domain_number"
      )
      .all(certId) as {
      id: number;
      domain_number: number;
      name: string;
      weight_percentage: number;
    }[];

    return { ...cert, domains };
  }

  getObjectives(
    certId: string,
    domainNumber?: number
  ): {
    id: string;
    cert_id: string;
    domain_id: number;
    objective_id: string;
    title: string;
    subtopics: string[];
  }[] {
    let sql =
      "SELECT o.id, o.cert_id, o.domain_id, o.objective_id, o.title, o.subtopics FROM objectives o";
    const params: unknown[] = [];

    if (domainNumber !== undefined) {
      sql +=
        " JOIN domains d ON o.domain_id = d.id WHERE o.cert_id = ? AND d.domain_number = ?";
      params.push(certId, domainNumber);
    } else {
      sql += " WHERE o.cert_id = ?";
      params.push(certId);
    }

    sql += " ORDER BY o.objective_id";

    const rows = this.db.prepare(sql).all(...params) as {
      id: string;
      cert_id: string;
      domain_id: number;
      objective_id: string;
      title: string;
      subtopics: string;
    }[];

    return rows.map((row) => ({
      ...row,
      subtopics: JSON.parse(row.subtopics) as string[],
    }));
  }

  recordAnswer(
    certId: string,
    objectiveId: string,
    correct: boolean,
    difficulty: Difficulty
  ): void {
    // Auto-detect the active (not yet ended) session for this cert
    const activeSession = this.db
      .prepare(
        "SELECT id FROM sessions WHERE cert_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1"
      )
      .get(certId) as { id: number } | undefined;

    this.db
      .prepare(
        `INSERT INTO answers (cert_id, objective_id, correct, difficulty, session_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(certId, objectiveId, correct ? 1 : 0, difficulty, activeSession?.id ?? null);
  }

  /**
   * Shared mastery query. Both getMasterySummary and getWeakAreas use the
   * same SQL — they differ only in sort direction and optional limit.
   */
  private queryMastery(
    certId: string | undefined,
    order: "ASC" | "DESC",
    limit?: number,
  ): MasteryScore[] {
    let sql = `
      SELECT
        a.cert_id,
        a.objective_id,
        o.title,
        d.name AS domain_name,
        ROUND(CAST(SUM(a.correct) AS REAL) / COUNT(*) * 100) AS mastery_percentage,
        COUNT(*) AS total_answers,
        SUM(CASE WHEN a.rowid > (SELECT MAX(rowid) - 10 FROM answers a2 WHERE a2.cert_id = a.cert_id AND a2.objective_id = a.objective_id) THEN a.correct ELSE 0 END) AS recent_correct,
        (SELECT COUNT(*) FROM answers a3 WHERE a3.cert_id = a.cert_id AND a3.objective_id = a.objective_id AND a3.rowid > (SELECT MAX(rowid) - 10 FROM answers a4 WHERE a4.cert_id = a.cert_id AND a4.objective_id = a.objective_id)) AS recent_total
      FROM answers a
      JOIN objectives o ON a.objective_id = o.id AND a.cert_id = o.cert_id
      JOIN domains d ON o.domain_id = d.id
    `;
    const params: unknown[] = [];

    if (certId !== undefined) {
      sql += " WHERE a.cert_id = ?";
      params.push(certId);
    }

    sql += ` GROUP BY a.cert_id, a.objective_id ORDER BY mastery_percentage ${order}`;

    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    return this.db.prepare(sql).all(...params) as MasteryScore[];
  }

  getMasterySummary(certId?: string): MasteryScore[] {
    return this.queryMastery(certId, "DESC");
  }

  getWeakAreas(certId?: string, limit?: number): MasteryScore[] {
    return this.queryMastery(certId, "ASC", limit);
  }

  startSession(certId: string): number {
    const result = this.db
      .prepare("INSERT INTO sessions (cert_id) VALUES (?)")
      .run(certId);
    return Number(result.lastInsertRowid);
  }

  endSession(
    sessionId: number,
    data: {
      topics_covered: string[];
      questions_asked: number;
      questions_correct: number;
      weak_areas_identified: string[];
      summary: string;
    }
  ): void {
    this.db
      .prepare(
        `UPDATE sessions SET
           end_time = datetime('now'),
           topics_covered = ?,
           questions_asked = ?,
           questions_correct = ?,
           weak_areas_identified = ?,
           summary = ?
         WHERE id = ?`
      )
      .run(
        JSON.stringify(data.topics_covered),
        data.questions_asked,
        data.questions_correct,
        JSON.stringify(data.weak_areas_identified),
        data.summary,
        sessionId
      );
  }

  getSessionHistory(certId?: string, limit?: number): SessionSummary[] {
    let sql = "SELECT * FROM sessions";
    const params: unknown[] = [];

    if (certId !== undefined) {
      sql += " WHERE cert_id = ?";
      params.push(certId);
    }

    sql += " ORDER BY id DESC";

    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as {
      id: number;
      cert_id: string;
      start_time: string;
      end_time: string | null;
      topics_covered: string;
      questions_asked: number;
      questions_correct: number;
      weak_areas_identified: string;
      summary: string;
    }[];

    return rows.map((row) => ({
      ...row,
      topics_covered: JSON.parse(row.topics_covered) as string[],
      weak_areas_identified: JSON.parse(row.weak_areas_identified) as string[],
    }));
  }

  /** Deletes a session and all answers linked to it.
   *  Returns true if the session existed and was deleted, false otherwise. */
  deleteSession(sessionId: number): boolean {
    const session = this.db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId) as { id: number } | undefined;

    if (!session) return false;

    const txn = this.db.transaction(() => {
      // Delete answers first — order matters because of FK constraint on session_id
      this.db
        .prepare("DELETE FROM answers WHERE session_id = ?")
        .run(sessionId);

      this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    });

    txn();
    return true;
  }

  close(): void {
    this.db.close();
  }
}
