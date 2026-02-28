import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface SessionInfo {
  id: number;
  cert_id: string;
  start_time: string;
  end_time: string | null;
  questions_asked: number;
  questions_correct: number;
  summary: string;
  topics_covered: string[];
}

@customElement("session-history-modal")
export class SessionHistoryModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) certId = "";

  @state() private sessions: SessionInfo[] = [];
  @state() private loading = false;
  @state() private confirmingId: number | null = null;
  @state() private deleting = false;

  static styles = css`
    :host {
      display: contents;
    }

    /* ── Backdrop ── */
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Modal ── */
    .modal {
      background: var(--bg-primary, #0d0d0c);
      border: 1px solid var(--border, #2a2825);
      border-radius: 12px;
      max-width: 560px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border, #2a2825);
      background: var(--bg-secondary, #161514);
    }

    .header-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: none;
      border-radius: 4px;
      color: var(--text-muted, #6b6560);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .close-btn:hover {
      background: var(--bg-hover, #262522);
      color: var(--text-primary, #e8e4df);
    }

    /* ── Body ── */
    .body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .session-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Session card ── */
    .session-card {
      position: relative;
      padding: 10px 12px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 6px;
      font-size: 12px;
    }

    .session-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      padding-right: 24px;
    }

    .session-date {
      color: var(--text-muted, #6b6560);
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-size: 10px;
    }

    .session-score {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-size: 10px;
      font-weight: 600;
      color: var(--text-secondary, #a09a92);
    }

    .session-summary {
      color: var(--text-secondary, #a09a92);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .session-topics {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .topic-tag {
      font-size: 10px;
      color: var(--text-muted, #6b6560);
      background: var(--bg-hover, #262522);
      border-radius: 3px;
      padding: 2px 6px;
    }

    /* ── Trash button ── */
    .trash-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: none;
      border: none;
      border-radius: 4px;
      color: var(--text-muted, #6b6560);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .trash-btn:hover {
      color: var(--error, #c75f5f);
    }

    /* ── Confirmation state ── */
    .session-card.confirming {
      background: rgba(199, 95, 95, 0.08);
    }

    .confirm-text {
      font-size: 12px;
      color: var(--text-secondary, #a09a92);
      line-height: 1.4;
      margin-bottom: 10px;
    }

    .confirm-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 4px 12px;
      background: none;
      border: 1px solid var(--border, #2a2825);
      border-radius: 4px;
      color: var(--text-secondary, #a09a92);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    .cancel-btn:hover {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
    }

    .delete-btn {
      padding: 4px 12px;
      background: var(--error, #c75f5f);
      border: none;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      transition: opacity 0.15s ease;
    }

    .delete-btn:hover {
      opacity: 0.9;
    }

    .delete-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ── Empty / loading ── */
    .empty,
    .loading-text {
      font-size: 12px;
      color: var(--text-muted, #6b6560);
      padding: 2px 0;
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

  updated(changed: Map<string | number | symbol, unknown>): void {
    if (
      (changed.has("open") || changed.has("certId")) &&
      this.open &&
      this.certId
    ) {
      this.fetchSessions();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && this.open) {
      this.close();
    }
  }

  private async fetchSessions(): Promise<void> {
    this.loading = true;
    this.confirmingId = null;
    try {
      const res = await fetch(`/api/sessions?cert_id=${encodeURIComponent(this.certId)}&limit=100`);
      this.sessions = await res.json();
    } catch {
      this.sessions = [];
    } finally {
      this.loading = false;
    }
  }

  private close(): void {
    this.confirmingId = null;
    this.dispatchEvent(
      new CustomEvent("close-session-history", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onBackdropClick(e: Event): void {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  private startDelete(id: number): void {
    this.confirmingId = id;
  }

  private cancelDelete(): void {
    this.confirmingId = null;
  }

  private async confirmDelete(id: number): Promise<void> {
    this.deleting = true;
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      await this.fetchSessions();
      this.dispatchEvent(
        new CustomEvent("session-deleted", {
          bubbles: true,
          composed: true,
        }),
      );
    } catch {
      // silently fail
    } finally {
      this.deleting = false;
      this.confirmingId = null;
    }
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  private renderCard(s: SessionInfo) {
    if (this.confirmingId === s.id) {
      return html`
        <div class="session-card confirming">
          <div class="confirm-text">
            Delete this session and its answer data? This will affect your mastery scores.
          </div>
          <div class="confirm-actions">
            <button class="cancel-btn" @click=${this.cancelDelete}>Cancel</button>
            <button
              class="delete-btn"
              ?disabled=${this.deleting}
              @click=${() => this.confirmDelete(s.id)}
            >${this.deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="session-card">
        <button
          class="trash-btn"
          @click=${() => this.startDelete(s.id)}
          aria-label="Delete session"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M5 2V1h6v1h4v1H1V2h4zm0 3v8h6V5H5zm2 1h2v6H7V6z" fill="currentColor"/>
          </svg>
        </button>
        <div class="session-meta">
          <span class="session-date">${this.formatDate(s.start_time)}</span>
          ${s.questions_asked > 0
            ? html`<span class="session-score">${s.questions_correct}/${s.questions_asked}</span>`
            : nothing
          }
        </div>
        ${s.summary
          ? html`<div class="session-summary">${s.summary}</div>`
          : nothing
        }
        ${s.topics_covered.length > 0
          ? html`
            <div class="session-topics">
              ${s.topics_covered.map(t => html`<span class="topic-tag">${t}</span>`)}
            </div>
          `
          : nothing
        }
      </div>
    `;
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="backdrop" @click=${this.onBackdropClick}>
        <div class="modal">
          <div class="header">
            <span class="header-title">Session History</span>
            <button class="close-btn" @click=${this.close} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="body">
            ${this.loading
              ? html`<span class="loading-text">Loading...</span>`
              : this.sessions.length === 0
                ? html`<span class="empty">No sessions recorded yet.</span>`
                : html`
                  <div class="session-list">
                    ${this.sessions.map(s => this.renderCard(s))}
                  </div>
                `
            }
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "session-history-modal": SessionHistoryModal;
  }
}
