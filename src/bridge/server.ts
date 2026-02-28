import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ClientMessage, type ServerMessage } from "./protocol.js";
import { ClaudeSdk } from "./claude-sdk.js";
import { parseSoulFile } from "./soul.js";
import { StudyDatabase } from "../mcp/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..", "..");

export interface BridgeServerOptions {
  port: number;
  staticDir?: string;
  soulPath?: string;
  model?: string;
}

export interface BridgeServer {
  server: Server;
  wss: WebSocketServer;
  close: () => Promise<void>;
}

function sendMessage(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export async function createBridgeServer(
  opts: BridgeServerOptions,
): Promise<BridgeServer> {
  const soulPath = opts.soulPath ?? resolve(projectRoot, "soul.md");
  const model = opts.model;

  const dbPath = resolve(projectRoot, "data/study.db");
  const db = new StudyDatabase(dbPath);

  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // REST API — sidebar data (bypasses Claude)
  app.get("/api/certs", (_req, res) => {
    const certs = db.listCerts();
    const certsDir = resolve(projectRoot, "data/certs");
    const enriched = certs.map(c => {
      try {
        const json = JSON.parse(readFileSync(resolve(certsDir, `${c.id}.json`), "utf-8"));
        return {
          ...c,
          question_count: json.question_count,
          time_minutes: json.time_minutes,
          passing_score: json.passing_score,
          max_score: json.max_score,
        };
      } catch {
        return c;
      }
    });
    res.json(enriched);
  });

  app.get("/api/mastery", (req, res) => {
    const certId = typeof req.query.cert_id === "string" ? req.query.cert_id : undefined;
    const resolved = certId ? db.resolveCertId(certId) : undefined;
    res.json(db.getMasterySummary(resolved));
  });

  app.get("/api/domains", (req, res) => {
    const certId = typeof req.query.cert_id === "string" ? req.query.cert_id : undefined;
    if (!certId) {
      res.json([]);
      return;
    }
    const resolved = db.resolveCertId(certId);
    const mastery = db.getMasterySummary(resolved);

    // Aggregate per domain
    const domainMap = new Map<string, { name: string; total: number; correct: number; objectives: number }>();
    for (const m of mastery) {
      const entry = domainMap.get(m.domain_name) ?? { name: m.domain_name, total: 0, correct: 0, objectives: 0 };
      entry.total += m.total_answers;
      entry.correct += Math.round(m.mastery_percentage * m.total_answers / 100);
      entry.objectives += 1;
      domainMap.set(m.domain_name, entry);
    }

    const domains = [...domainMap.values()].map(d => ({
      name: d.name,
      mastery_percentage: d.total > 0 ? Math.round(d.correct / d.total * 100) : 0,
      total_answers: d.total,
      objectives_studied: d.objectives,
    }));

    res.json(domains);
  });

  app.get("/api/sessions", (req, res) => {
    const certId = typeof req.query.cert_id === "string" ? req.query.cert_id : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 5;
    const resolved = certId ? db.resolveCertId(certId) : undefined;
    res.json(db.getSessionHistory(resolved, limit));
  });

  app.delete("/api/sessions/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }
    const deleted = db.deleteSession(id);
    if (!deleted) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ ok: true });
  });

  if (opts.staticDir) {
    app.use(express.static(opts.staticDir));
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    const claude = new ClaudeSdk();

    claude.onText = (text) => {
      sendMessage(ws, { type: "agent_stream_chunk", content: text });
    };
    claude.onResult = (text) => {
      const quizRegex = /```quiz\s*\n([\s\S]*?)```/g;
      const quizMatches = [...text.matchAll(quizRegex)];

      if (quizMatches.length > 0) {
        const questions: Array<Record<string, unknown>> = [];

        for (let i = 0; i < quizMatches.length; i++) {
          try {
            const config = JSON.parse(quizMatches[i][1]);
            const type = config.type ?? "multiple_choice";
            const base = {
              id: i + 1,
              type,
              text: config.question,
              objectiveId: config.objective_id,
            };

            if (type === "short_answer") {
              questions.push({ ...base, answer: config.answer ?? "" });
            } else if (type === "match") {
              // Normalize pairs to [["term","def"],...] tuples.
              // Sage may send: object, array of objects, or array of tuples.
              let rawPairs = config.pairs ?? [];
              let pairs: [string, string][];
              if (!Array.isArray(rawPairs) && typeof rawPairs === "object") {
                pairs = Object.entries(rawPairs);
              } else if (
                Array.isArray(rawPairs) &&
                rawPairs.length > 0 &&
                typeof rawPairs[0] === "object" &&
                !Array.isArray(rawPairs[0])
              ) {
                pairs = rawPairs.map((obj: Record<string, string>) => {
                  const vals = Object.values(obj);
                  return [String(vals[0] ?? ""), String(vals[1] ?? "")];
                });
              } else {
                pairs = rawPairs;
              }
              questions.push({ ...base, pairs });
            } else {
              questions.push({
                ...base,
                type: "multiple_choice",
                options: config.options,
                correct: config.correct,
              });
            }
          } catch (err) {
            console.warn(`[quiz-parse] Skipping malformed quiz block ${i + 1}:`, (err as Error).message, "\nRaw:", quizMatches[i][1].slice(0, 200));
          }
        }

        if (questions.length > 0) {
          sendMessage(ws, {
            type: "quiz_set",
            content: JSON.stringify({ questions }),
          });

          const nonQuizText = text.replace(quizRegex, "").trim();
          if (nonQuizText) {
            sendMessage(ws, { type: "agent_stream_end", content: nonQuizText });
          } else {
            sendMessage(ws, { type: "agent_stream_end", content: "" });
          }
          return;
        }
      }

      sendMessage(ws, { type: "agent_stream_end", content: text });
    };
    claude.onError = (error) => {
      sendMessage(ws, { type: "error", content: error });
    };
    claude.onTerminalError = (error, reason) => {
      const reasonLabels: Record<string, string> = {
        error_max_budget_usd: "Session budget limit reached.",
        error_max_turns: "Session turn limit reached.",
        authentication_failed: "Authentication failed.",
        billing_error: "Billing error.",
      };
      sendMessage(ws, { type: "error", content: error });
      sendMessage(ws, {
        type: "session_ended",
        content: reasonLabels[reason] ?? "Session ended unexpectedly.",
      });
      claude.close();
    };

    const systemPrompt = parseSoulFile(soulPath);
    claude.configure({
      systemPrompt: systemPrompt || undefined,
      model,
      mcpServers: {
        "study-tools": {
          command: "tsx",
          args: [resolve(projectRoot, "src/mcp/server.ts")],
          env: { STUDY_DB_PATH: resolve(projectRoot, "data/study.db") },
        },
      },
    });

    ws.on("message", async (data) => {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      const msg = parseClientMessage(raw);

      if (!msg) {
        sendMessage(ws, { type: "error", content: "Invalid message format" });
        return;
      }

      if (msg.type === "start_session") {
        const certHint = msg.cert_id
          ? ` The student selected certification "${msg.cert_id}".`
          : "";
        await claude.send(
          `The student just opened the app.${certHint} Start a new session — check their mastery data and session history with your tools, then greet them. If this looks like a first session (no history), introduce yourself briefly. If they have history, welcome them back and suggest where to pick up.`,
        );
        return;
      }

      if (msg.type === "end_session") {
        try {
          await claude.send(
            "The student clicked 'End Session'. Wrap up the current session: summarize what was covered, record the session data using your end_session tool (include topics_covered, questions counts, weak_areas_identified, and a brief summary), then say goodbye. Keep it concise.",
          );
        } finally {
          sendMessage(ws, { type: "session_ended", content: "" });
        }
        return;
      }

      if (msg.type === "study_mode") {
        const mode = msg.mode ?? "quiz";
        const quizReminder = " IMPORTANT: Every question MUST use the ```quiz block format. Multiple choice: ```quiz\\n{\"question\": \"...\", \"options\": [...], \"correct\": 0, \"objective_id\": \"...\"}\\n```. Short answer: ```quiz\\n{\"type\": \"short_answer\", \"question\": \"...\", \"answer\": \"...\", \"objective_id\": \"...\"}\\n```. Match: ```quiz\\n{\"type\": \"match\", \"question\": \"...\", \"pairs\": [[\"term\", \"def\"], ...], \"objective_id\": \"...\"}\\n```. The UI renders these as interactive cards — plain-text questions are NOT interactive. Mix question types for variety.";
        const prompts: Record<string, string> = {
          quiz: "The student wants Quiz Mode. Give them a focused quiz: 10 multiple-choice questions on their weakest areas (check mastery data). Track a running score. At the end, summarize their performance and record all answers." + quizReminder,
          review: "The student wants Review Mode. Check their mastery data for weak areas. Pick the weakest topic and teach it — explain the concept clearly, give examples, then test their understanding with 2-3 questions. Focus on building understanding, not just testing recall." + quizReminder,
          quick: "The student wants a Quick Check. Give them 3-5 quick questions based on their mastery data — focus on areas that need reinforcement. Keep it fast and focused, then give a brief summary." + quizReminder,
        };
        await claude.send(prompts[mode] ?? prompts.quiz);
        return;
      }

      if (msg.type === "quiz_answers") {
        const answerPayload = msg.content ?? "{}";
        let parsed: { answers: Array<{ questionId: number; type?: string; selected?: number; text?: string; pairs?: Record<string, string> }> };
        try {
          parsed = JSON.parse(answerPayload);
        } catch {
          sendMessage(ws, { type: "error", content: "Invalid quiz answers format" });
          return;
        }

        if (!Array.isArray(parsed.answers)) {
          sendMessage(ws, { type: "error", content: "Invalid quiz answers format" });
          return;
        }

        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const lines = parsed.answers.map((a) => {
          if (a.type === "short_answer") {
            return `Question ${a.questionId} (short answer): student wrote "${a.text ?? ""}"`;
          }
          if (a.type === "match") {
            const pairEntries = Object.entries(a.pairs ?? {});
            const pairText = pairEntries.map(([t, d]) => `${t}→${d}`).join(", ");
            return `Question ${a.questionId} (match): student paired ${pairText}`;
          }
          return `Question ${a.questionId}: selected ${labels[a.selected ?? -1] ?? a.selected}`;
        });

        const prompt = `The student just completed a quiz. Here are their answers:\n${lines.join("\n")}\n\nReview their answers against the correct answers, calculate their score, explain what they got wrong and why, and record the results. For short answer questions, judge whether the student's response is correct or demonstrates understanding of the concept — be fair but rigorous.`;
        await claude.send(prompt);
        return;
      }

      if (msg.type === "user_message") {
        const content = msg.content ?? "";
        if (!content.trim()) {
          sendMessage(ws, { type: "error", content: "Empty message" });
          return;
        }
        await claude.send(
          content +
            "\n\n[System reminder: When giving questions, you MUST use the ```quiz block format from your system prompt. Supported types: multiple_choice (default), short_answer, match. The UI renders these as interactive cards. Plain-text questions are NOT interactive.]",
        );
        return;
      }

      // All known message types are handled above; this is unreachable
      // unless a new type is added to the protocol without a handler.
      sendMessage(ws, { type: "status", content: `Received ${(msg as ClientMessage).type}` });
    });

    ws.on("close", () => {
      claude.close();
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(opts.port, () => { resolve(); });
  });

  const close = async (): Promise<void> => {
    // Notify all connected clients before closing
    for (const client of wss.clients) {
      sendMessage(client as WebSocket, {
        type: "server_shutdown",
        content: "Server is shutting down.",
      });
      client.close();
    }

    // Shut down with a 5s timeout so we don't block forever
    const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Shutdown timeout")), ms),
        ),
      ]);

    try {
      await timeout(
        new Promise<void>((resolve, reject) => {
          wss.close((err) => { if (err) reject(err); else resolve(); });
        }),
        5000,
      );
    } catch {
      // Best-effort — proceed to close HTTP server
    }

    try {
      await timeout(
        new Promise<void>((resolve, reject) => {
          server.close((err) => { if (err) reject(err); else resolve(); });
        }),
        5000,
      );
    } catch {
      // Best-effort
    }

    db.close();
  };

  return { server, wss, close };
}
