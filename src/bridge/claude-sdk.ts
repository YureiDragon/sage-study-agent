import {
  query,
  type Query,
  type McpServerConfig,
} from "@anthropic-ai/claude-agent-sdk";

export type { McpServerConfig };

export interface ClaudeSdkOptions {
  systemPrompt?: string;
  model?: string;
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Wraps the Claude Agent SDK for use by the bridge server.
 *
 * Each WebSocket connection gets one ClaudeSdk instance. The first
 * `send()` creates a new session; subsequent calls resume it via
 * the captured session ID.
 */
export class ClaudeSdk {
  private options: ClaudeSdkOptions | null = null;
  private _sessionId: string | undefined;
  private activeQuery: Query | null = null;

  onText: ((text: string) => void) | null = null;
  onResult: ((text: string) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onTerminalError: ((error: string, reason: string) => void) | null = null;

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get isConfigured(): boolean {
    return this.options !== null;
  }

  configure(opts: ClaudeSdkOptions): void {
    this.options = opts;
    this._sessionId = undefined;
  }

  async send(message: string): Promise<void> {
    if (!this.options) {
      this.onError?.("Claude SDK not configured");
      return;
    }

    // Cancel any in-flight query
    if (this.activeQuery) {
      this.activeQuery.close();
      this.activeQuery = null;
    }

    try {
      const isNewSession = this._sessionId === undefined;

      const q = query({
        prompt: message,
        options: {
          ...(this._sessionId ? { resume: this._sessionId } : {}),
          ...(isNewSession && this.options.systemPrompt
            ? { systemPrompt: this.options.systemPrompt }
            : {}),
          model: this.options.model,
          mcpServers: this.options.mcpServers,
          allowedTools: ["mcp__study-tools__*"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true,
        },
      });

      this.activeQuery = q;

      for await (const msg of q) {
        // Capture session ID from init message
        if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
          this._sessionId = msg.session_id;
        }

        // Check for assistant-level terminal errors
        if (msg.type === "assistant" && "error" in msg) {
          const err = (msg as { error: { type: string; message?: string } }).error;
          const terminalAssistantErrors = ["authentication_failed", "billing_error"];
          if (terminalAssistantErrors.includes(err.type)) {
            const errorText = err.message ?? err.type;
            this.onTerminalError?.(errorText, err.type);
            return;
          }
        }

        // Stream text deltas from partial messages
        if (msg.type === "stream_event") {
          const event = (msg as { event: { type: string; delta?: { type: string; text?: string } } }).event;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            this.onText?.(event.delta.text);
          }
        }

        // Final result
        if (msg.type === "result") {
          if (msg.subtype === "success") {
            this.onResult?.(typeof msg.result === "string" ? msg.result : "");
          } else {
            // Classify terminal vs recoverable errors
            const terminalSubtypes = ["error_max_budget_usd", "error_max_turns"];
            const errors = "errors" in msg && Array.isArray(msg.errors)
              ? msg.errors
              : [];
            const errorText = errors.join("; ") || `Query failed: ${msg.subtype}`;

            if (terminalSubtypes.includes(msg.subtype)) {
              this.onTerminalError?.(errorText, msg.subtype);
            } else {
              this.onError?.(errorText);
            }
          }
        }
      }
    } catch (err: unknown) {
      // Silence AbortError — intentional cancellation from close()
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      this.onError?.(message);
    } finally {
      this.activeQuery = null;
    }
  }

  close(): void {
    if (this.activeQuery) {
      this.activeQuery.close();
      this.activeQuery = null;
    }
  }
}
