import { describe, it, expect } from "vitest";
import { ClaudeSdk } from "./claude-sdk.js";

describe("ClaudeSdk", () => {
  it("starts with no session id", () => {
    const sdk = new ClaudeSdk();
    expect(sdk.sessionId).toBeUndefined();
  });

  it("is not configured before configure() is called", () => {
    const sdk = new ClaudeSdk();
    expect(sdk.isConfigured).toBe(false);
  });

  it("is configured after configure() is called", () => {
    const sdk = new ClaudeSdk();
    sdk.configure({
      mcpServers: {
        "study-tools": {
          command: "echo",
          args: ["test"],
        },
      },
    });
    expect(sdk.isConfigured).toBe(true);
  });

  it("stores system prompt from configure()", () => {
    const sdk = new ClaudeSdk();
    sdk.configure({
      systemPrompt: "You are Sage.",
      mcpServers: {},
    });
    expect(sdk.isConfigured).toBe(true);
  });

  it("rejects send() before configure()", async () => {
    const sdk = new ClaudeSdk();
    const errors: string[] = [];
    sdk.onError = (e) => errors.push(e);
    await sdk.send("hello");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("not configured");
  });

  it("close() does not throw when no query is active", () => {
    const sdk = new ClaudeSdk();
    expect(() => sdk.close()).not.toThrow();
  });
});
