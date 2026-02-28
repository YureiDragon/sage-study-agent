import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { preprocessStreaming } from "../../services/marked-extensions.js";
import "./chat-message.js";
import "./chat-input.js";

interface ChatMessageData {
  role: "user" | "agent";
  content: string;
}

@customElement("chat-panel")
export class ChatPanel extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) userName = "You";
  @state() private messages: ChatMessageData[] = [];
  @state() private streamingContent = "";
  @state() private thinking = false;
  @state() private quizAvailable = false;

  @query(".messages") private messagesContainer!: HTMLElement;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--bg-primary, #0d0d0c);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
      color: var(--text-muted, #6b6560);
    }

    .empty-logo {
      font-family: var(--font-display, "Instrument Serif", serif);
      font-size: 36px;
      color: var(--accent, #d4a574);
      opacity: 0.4;
    }

    .empty-text {
      font-size: 13px;
      letter-spacing: 0.02em;
    }

    chat-message.streaming {
      opacity: 0.85;
    }

    .thinking {
      max-width: 800px;
      margin: 0 auto;
      padding: 12px 24px;
    }

    .thinking-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent, #d4a574);
      margin-bottom: 8px;
    }

    .thinking-bar {
      width: 48px;
      height: 3px;
      border-radius: 2px;
      background: var(--bg-tertiary, #1e1d1b);
      overflow: hidden;
      position: relative;
    }

    .thinking-bar::after {
      content: "";
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: var(--accent, #d4a574);
      border-radius: 2px;
      animation: slide 1.4s ease-in-out infinite;
    }

    @keyframes slide {
      0% { left: -100%; }
      50% { left: 100%; }
      100% { left: 100%; }
    }

    .quiz-float {
      display: flex;
      justify-content: center;
      padding: 8px 24px;
    }

    .quiz-float-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--accent, #d4a574);
      border-radius: 8px;
      color: var(--accent, #d4a574);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      letter-spacing: 0.03em;
      transition: all 0.2s ease;
    }

    .quiz-float-btn:hover {
      background: var(--accent-dim, rgba(212, 165, 116, 0.12));
    }

    .quiz-float-btn svg {
      flex-shrink: 0;
    }

    /* Themed scrollbar (Shadow DOM doesn't inherit global styles) */
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: var(--border-light, #353230);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted, #6b6560);
    }
  `;

  setThinking(value: boolean): void {
    this.thinking = value;
    if (value) this.scrollToBottom();
  }

  setQuizAvailable(value: boolean): void {
    this.quizAvailable = value;
  }

  addUserMessage(content: string): void {
    this.messages = [...this.messages, { role: "user", content }];
    this.scrollToBottom();
  }

  addAgentMessage(content: string): void {
    this.thinking = false;
    this.streamingContent = "";
    this.messages = [...this.messages, { role: "agent", content }];
    this.scrollToBottom();
  }

  appendStream(chunk: string): void {
    this.thinking = false;
    this.streamingContent += chunk;
    this.scrollToBottom();
  }

  /** Discard accumulated stream without finalizing it as a message.
   *  Does not reset thinking state — callers manage that independently. */
  discardStream(): void {
    this.streamingContent = "";
  }

  /** Converts accumulated stream chunks into a finalized message.
   *  Returns true if there was streamed content to finalize. */
  finalizeStream(): boolean {
    this.thinking = false;
    if (this.streamingContent) {
      this.messages = [
        ...this.messages,
        { role: "agent", content: this.streamingContent },
      ];
      this.streamingContent = "";
      this.scrollToBottom();
      return true;
    }
    return false;
  }

  private reopenQuiz(): void {
    this.dispatchEvent(
      new CustomEvent("reopen-quiz", { bubbles: true, composed: true }),
    );
  }

  private scrollToBottom(): void {
    this.updateComplete.then(() => {
      const container = this.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  render() {
    const isEmpty = this.messages.length === 0 && !this.streamingContent && !this.thinking;

    return html`
      <div class="messages">
        ${isEmpty
          ? html`<div class="empty-state">
              <span class="empty-logo">Sage</span>
              <span class="empty-text">Connecting...</span>
            </div>`
          : html`
              ${this.messages.map(
                (msg) =>
                  html`<chat-message
                    .role=${msg.role}
                    .content=${msg.content}
                    .userName=${this.userName}
                  ></chat-message>`
              )}
              ${this.streamingContent
                ? html`<chat-message
                    class="streaming"
                    .role=${"agent" as const}
                    .content=${preprocessStreaming(this.streamingContent)}
                  ></chat-message>`
                : ""}
              ${this.thinking && !this.streamingContent
                ? html`<div class="thinking">
                    <div class="thinking-label">Sage</div>
                    <div class="thinking-bar"></div>
                  </div>`
                : ""}
            `}
      </div>
      ${this.quizAvailable && !this.streamingContent
        ? html`<div class="quiz-float">
            <button class="quiz-float-btn" @click=${this.reopenQuiz}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v6h6M8 1a7 7 0 1 0 7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Open Quiz
            </button>
          </div>`
        : ""}
      <chat-input
        ?disabled=${this.disabled}
      ></chat-input>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-panel": ChatPanel;
  }
}
