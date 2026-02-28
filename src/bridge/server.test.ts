import { describe, it, expect, afterEach } from "vitest";
import { parseClientMessage } from "./protocol.js";
import { createBridgeServer } from "./server.js";

// --- protocol tests ---

describe("parseClientMessage", () => {
  it("parses a valid user_message", () => {
    const msg = parseClientMessage(
      JSON.stringify({ type: "user_message", content: "hello" }),
    );
    expect(msg).toEqual({ type: "user_message", content: "hello" });
  });

  it("parses a valid start_session with cert_id", () => {
    const msg = parseClientMessage(
      JSON.stringify({ type: "start_session", cert_id: "aws-saa" }),
    );
    expect(msg).toEqual({ type: "start_session", cert_id: "aws-saa" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
  });

  it("returns null when type is missing", () => {
    expect(parseClientMessage(JSON.stringify({ content: "hi" }))).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseClientMessage("")).toBeNull();
  });

  it("parses a valid quiz_answers message", () => {
    const msg = parseClientMessage(
      JSON.stringify({
        type: "quiz_answers",
        content: JSON.stringify({ answers: [{ questionId: 1, selected: 2 }] }),
      }),
    );
    expect(msg).toEqual({
      type: "quiz_answers",
      content: JSON.stringify({ answers: [{ questionId: 1, selected: 2 }] }),
    });
  });
});

// --- server tests ---

describe("createBridgeServer", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it("starts and listens on a port", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    expect(addr).not.toBeNull();
    expect(typeof addr === "object" && addr !== null ? addr.port : 0).toBeGreaterThan(0);
  });

  it("health endpoint returns 200 with { status: 'ok' }", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("unexpected address");

    const res = await fetch(`http://127.0.0.1:${addr.port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("accepts WebSocket connections at /ws", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("unexpected address");

    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("echoes a status reply for unhandled message types", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("unexpected address");

    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });

    const replyPromise = new Promise<string>((resolve) => {
      ws.addEventListener("message", (e) => {
        resolve(typeof e.data === "string" ? e.data : "");
      });
    });

    ws.send(JSON.stringify({ type: "ping" }));

    const reply = await replyPromise;
    const parsed = JSON.parse(reply);
    expect(parsed.type).toBe("status");
    expect(parsed.content).toBe("Received ping");

    ws.close();
  });

  it("replies with error for invalid messages", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("unexpected address");

    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });

    const replyPromise = new Promise<string>((resolve) => {
      ws.addEventListener("message", (e) => {
        resolve(typeof e.data === "string" ? e.data : "");
      });
    });

    ws.send("not valid json");

    const reply = await replyPromise;
    const parsed = JSON.parse(reply);
    expect(parsed.type).toBe("error");

    ws.close();
  });

  it("DELETE /api/sessions/:id returns 404 for non-existent session", async () => {
    const { server, close } = await createBridgeServer({ port: 0 });
    cleanup = close;

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("unexpected address");
    const base = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${base}/api/sessions/99999`, { method: "DELETE" });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({ error: "Session not found" });
  });
});
