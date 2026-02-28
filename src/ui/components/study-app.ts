import { LitElement, html, css, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { WsClient } from "../services/ws-client.js";
import type { ServerMessage } from "../services/ws-client.js";
import "./chat/chat-panel.js";
import "./sidebar/sidebar-dashboard.js";
import type { ChatPanel } from "./chat/chat-panel.js";
import type { SidebarDashboard } from "./sidebar/sidebar-dashboard.js";
import "./quiz/quiz-panel.js";
import type { QuizPanel } from "./quiz/quiz-panel.js";
import "./welcome/welcome-screen.js";
import "./session/session-history-modal.js";

const LS_KEY_NAME = "sage-user-name";
const LS_KEY_CERT = "sage-last-cert";

@customElement("study-app")
export class StudyApp extends LitElement {
  @state() sidebarOpen = true;
  @state() connected = false;
  @state() userName = "";
  @state() nameConfirmed = false;
  @state() sessionActive = false;
  @state() showWelcome = true;
  @state() lastCertId = "";
  @state() showSessionHistory = false;
  @state() sessionHistoryCertId = "";

  @query("chat-panel") private chatPanel!: ChatPanel;
  @query("sidebar-dashboard") private dashboard!: SidebarDashboard;
  @query("quiz-panel") private quizPanel!: QuizPanel;

  private ws = new WsClient();
  private handlePageHide = () => {
    if (this.sessionActive) {
      this.ws.disconnect();
    }
  };

  static styles = css`
    :host {
      display: flex;
      height: 100vh;
      width: 100%;
      overflow: hidden;
      font-family: var(--font-sans, "DM Sans", sans-serif);
      background: var(--bg-primary, #0d0d0c);
      color: var(--text-primary, #e8e4df);
    }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-width, 280px);
      min-width: var(--sidebar-width, 280px);
      background: var(--bg-secondary, #161514);
      border-right: 1px solid var(--border, #2a2825);
      display: flex;
      flex-direction: column;
      transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
    }

    .sidebar.collapsed {
      margin-left: calc(-1 * var(--sidebar-width, 280px));
    }

    .sidebar-brand {
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--border, #2a2825);
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .brand-name {
      font-family: var(--font-display, "Instrument Serif", serif);
      font-size: 28px;
      font-weight: 400;
      color: var(--accent, #d4a574);
      line-height: 1;
      letter-spacing: -0.01em;
    }

    .brand-tag {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted, #6b6560);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ── Sidebar content ── */
    .sidebar-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    /* ── Main Area ── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      position: relative;
    }

    /* ── Top bar ── */
    .topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      background: var(--bg-secondary, #161514);
      border-bottom: 1px solid var(--border, #2a2825);
      height: 48px;
      min-height: 48px;
    }

    .hamburger {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: 1px solid var(--border, #2a2825);
      border-radius: 6px;
      color: var(--text-secondary, #a09a92);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      transition: all 0.2s ease;
    }

    .hamburger:hover {
      background: var(--bg-hover, #262522);
      color: var(--text-primary, #e8e4df);
      border-color: var(--border-light, #353230);
    }

    .topbar-brand {
      font-family: var(--font-display, "Instrument Serif", serif);
      font-size: 18px;
      color: var(--accent, #d4a574);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .topbar-brand.visible {
      opacity: 1;
    }

    .end-session-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: none;
      border: 1px solid var(--border, #2a2825);
      border-radius: 6px;
      color: var(--text-muted, #6b6560);
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.02em;
      transition: all 0.2s ease;
    }

    .end-session-btn:hover {
      border-color: var(--error, #c75f5f);
      color: var(--error, #c75f5f);
      background: rgba(199, 95, 95, 0.08);
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted, #6b6560);
      letter-spacing: 0.02em;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--error, #c75f5f);
      transition: background 0.3s ease;
    }

    .status-dot.connected {
      background: var(--success, #7a9e7e);
    }

    chat-panel {
      flex: 1;
      min-height: 0;
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

  connectedCallback(): void {
    super.connectedCallback();

    // Load saved state from localStorage
    const saved = localStorage.getItem(LS_KEY_NAME);
    if (saved) {
      this.userName = saved;
      this.nameConfirmed = true;
    }
    this.lastCertId = localStorage.getItem(LS_KEY_CERT) ?? "";

    this.ws.onStatus = (connected: boolean) => {
      this.connected = connected;
    };

    this.ws.onMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case "agent_text":
          this.chatPanel.addAgentMessage(msg.content);
          break;
        case "agent_stream_chunk":
          this.chatPanel.appendStream(msg.content);
          break;
        case "agent_stream_end": {
          const hadStream = this.chatPanel.finalizeStream();
          if (!hadStream && msg.content) {
            this.chatPanel.addAgentMessage(msg.content);
          }
          this.refreshDashboard();
          break;
        }
        case "session_ended":
          this.chatPanel?.finalizeStream();
          if (msg.content) {
            this.chatPanel?.addAgentMessage(msg.content);
          }
          this.sessionActive = false;
          this.showWelcome = true;
          this.chatPanel?.setQuizAvailable(false);
          this.refreshDashboard();
          break;
        case "server_shutdown":
          this.chatPanel?.finalizeStream();
          this.chatPanel?.addAgentMessage("The server is shutting down. Your session has ended.");
          this.ws.disconnect();
          this.sessionActive = false;
          this.showWelcome = true;
          this.chatPanel?.setQuizAvailable(false);
          break;
        case "error":
          this.chatPanel.addAgentMessage("**Error:** " + msg.content);
          break;
        case "status":
          break;
        case "quiz_set": {
          try {
            const data = JSON.parse(msg.content);
            if (Array.isArray(data.questions)) {
              this.chatPanel?.discardStream();
              this.chatPanel?.setQuizAvailable(true);
              this.updateComplete.then(() => {
                this.quizPanel?.loadQuestions(data.questions);
              });
            }
          } catch {
            // Malformed quiz_set — ignore
          }
          break;
        }
      }
    };

    this.addEventListener("name-confirmed", ((e: CustomEvent) => {
      this.userName = e.detail.name;
      this.nameConfirmed = true;
      localStorage.setItem(LS_KEY_NAME, e.detail.name);
    }) as EventListener);

    this.addEventListener("name-edit", (() => {
      this.nameConfirmed = false;
    }) as EventListener);

    this.addEventListener("start-session", ((e: CustomEvent) => {
      const { certId } = e.detail;
      this.showWelcome = false;
      this.sessionActive = true;
      this.lastCertId = certId;
      localStorage.setItem(LS_KEY_CERT, certId);
      this.ws.send({ type: "start_session", cert_id: certId });
      this.updateComplete.then(() => {
        this.chatPanel?.setThinking(true);
      });
    }) as EventListener);

    this.ws.connect();

    this.addEventListener("answer-selected", ((e: CustomEvent) => {
      const { selected, correct, isCorrect, objectiveId } = e.detail;
      const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
      const result = isCorrect ? "correct" : `incorrect (correct answer: ${labels[correct]})`;
      const answerText = `I answered ${labels[selected]} — ${result}${objectiveId ? ` (objective ${objectiveId})` : ""}`;

      this.chatPanel.addUserMessage(answerText);
      this.chatPanel.setThinking(true);
      this.ws.sendMessage(answerText);
    }) as EventListener);

    this.addEventListener("mode-selected", ((e: CustomEvent) => {
      const { mode } = e.detail;
      const modeLabels: Record<string, string> = {
        quiz: "Quiz Mode",
        review: "Review Mode",
        quick: "Quick Check",
      };
      this.chatPanel.addUserMessage(`Start ${modeLabels[mode] ?? mode}`);
      this.chatPanel.setThinking(true);
      this.ws.send({ type: "study_mode", mode });
    }) as EventListener);

    this.addEventListener("quiz-submitted", ((e: CustomEvent) => {
      const { answers } = e.detail;
      this.quizPanel?.closePanel();
      this.chatPanel?.setQuizAvailable(false);
      this.chatPanel.setThinking(true);
      this.ws.send({
        type: "quiz_answers",
        content: JSON.stringify({ answers }),
      });
    }) as EventListener);

    this.addEventListener("reopen-quiz", (() => {
      this.quizPanel?.reopenPanel();
    }) as EventListener);

    this.addEventListener("open-session-history", ((e: CustomEvent) => {
      this.sessionHistoryCertId = e.detail.certId ?? this.lastCertId;
      this.showSessionHistory = true;
    }) as EventListener);

    this.addEventListener("session-deleted", (() => {
      this.refreshDashboard();
    }) as EventListener);

    this.addEventListener("close-session-history", (() => {
      this.showSessionHistory = false;
    }) as EventListener);

    window.addEventListener("pagehide", this.handlePageHide);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("pagehide", this.handlePageHide);
    this.ws.disconnect();
  }

  private handleSendMessage(e: CustomEvent<{ content: string }>): void {
    const { content } = e.detail;
    this.chatPanel.addUserMessage(content);
    this.chatPanel.setThinking(true);
    this.ws.sendMessage(content);
  }

  private endSession(): void {
    this.chatPanel.setThinking(true);
    this.ws.send({ type: "end_session" });
  }

  private refreshDashboard(): void {
    this.updateComplete.then(() => {
      this.dashboard?.refresh();
    });
  }

  private toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  render() {
    return html`
      <aside class="sidebar ${this.sidebarOpen ? "" : "collapsed"}">
        <div class="sidebar-brand">
          <span class="brand-name">Sage</span>
          <span class="brand-tag">study tutor</span>
        </div>
        <div class="sidebar-content">
          <sidebar-dashboard></sidebar-dashboard>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button
            class="hamburger"
            @click=${this.toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="topbar-brand ${this.sidebarOpen ? "" : "visible"}">Sage</span>
          ${this.sessionActive && this.connected
            ? html`<button
                class="end-session-btn"
                @click=${this.endSession}
              >End Session</button>`
            : nothing
          }
          <div class="status">
            <span class="status-dot ${this.connected ? "connected" : ""}"></span>
            <span>${this.connected ? "Connected" : "Disconnected"}</span>
          </div>
        </header>

        ${this.showWelcome
          ? html`<welcome-screen
              .userName=${this.userName}
              ?nameConfirmed=${this.nameConfirmed}
              .lastCertId=${this.lastCertId}
            ></welcome-screen>`
          : html`
              <chat-panel
                ?disabled=${!this.connected}
                .userName=${this.userName || "You"}
                @send-message=${this.handleSendMessage}
              ></chat-panel>
              <quiz-panel></quiz-panel>
            `
        }
      </div>

      <session-history-modal
        ?open=${this.showSessionHistory}
        .certId=${this.sessionHistoryCertId}
      ></session-history-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "study-app": StudyApp;
  }
}
