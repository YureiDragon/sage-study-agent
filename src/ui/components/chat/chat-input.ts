import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";

@customElement("chat-input")
export class ChatInput extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @query("textarea") private textarea!: HTMLTextAreaElement;

  static styles = css`
    :host {
      display: block;
      max-width: 800px;
      margin: 0 auto;
      padding: 8px 24px 20px;
      width: 100%;
      box-sizing: border-box;
    }

    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 6px 6px 6px 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .input-row:focus-within {
      border-color: var(--accent, #d4a574);
      box-shadow: 0 0 0 1px var(--accent-dim, rgba(212, 165, 116, 0.12));
    }

    textarea {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      resize: none;
      color: var(--text-primary, #e8e4df);
      font-family: var(--font-sans, "DM Sans", sans-serif);
      font-size: 14px;
      line-height: 1.5;
      max-height: 150px;
      overflow-y: auto;
      padding: 4px 0;
    }

    textarea::placeholder {
      color: var(--text-muted, #6b6560);
    }

    textarea:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      min-width: 32px;
      border: none;
      border-radius: 7px;
      background: var(--accent, #d4a574);
      color: var(--bg-primary, #0d0d0c);
      cursor: pointer;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    .send-btn:hover:not(:disabled) {
      background: var(--accent-hover, #e0b98e);
    }

    .send-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .send-btn svg {
      width: 16px;
      height: 16px;
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

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  private handleInput(): void {
    const ta = this.textarea;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }

  private send(): void {
    const content = this.textarea.value.trim();
    if (!content || this.disabled) return;

    this.dispatchEvent(
      new CustomEvent("send-message", {
        detail: { content },
        bubbles: true,
        composed: true,
      })
    );

    this.textarea.value = "";
    this.textarea.style.height = "auto";
  }

  render() {
    return html`
      <div class="input-row">
        <textarea
          rows="1"
          placeholder="Message Sage..."
          ?disabled=${this.disabled}
          @keydown=${this.handleKeydown}
          @input=${this.handleInput}
        ></textarea>
        <button
          class="send-btn"
          ?disabled=${this.disabled}
          @click=${this.send}
          aria-label="Send message"
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M3 13V9l10-1-10-1V3l13 5-13 5z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-input": ChatInput;
  }
}
