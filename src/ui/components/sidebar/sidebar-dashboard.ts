import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

interface DomainMastery {
  name: string;
  mastery_percentage: number;
  total_answers: number;
  objectives_studied: number;
}

interface CertInfo {
  id: string;
  name: string;
  exam_code: string;
}

interface SessionInfo {
  id: number;
  cert_id: string;
  start_time: string;
  end_time: string | null;
  questions_asked: number;
  questions_correct: number;
  summary: string;
}

@customElement("sidebar-dashboard")
export class SidebarDashboard extends LitElement {
  @state() private certs: CertInfo[] = [];
  @state() private domains: DomainMastery[] = [];
  @state() private sessions: SessionInfo[] = [];
  @state() private activeCert: string | null = null;
  @state() private loading = true;

  /** Incremented on each fetchData call; stale responses are discarded. */
  private fetchGeneration = 0;

  static styles = css`
    :host {
      display: block;
    }

    .section {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border, #2a2825);
    }

    .section:last-child {
      border-bottom: none;
    }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
      margin-bottom: 10px;
    }

    .view-all-btn {
      font-size: 10px;
      font-weight: 500;
      color: var(--accent, #d4a574);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      letter-spacing: 0.02em;
    }

    .view-all-btn:hover {
      text-decoration: underline;
    }

    /* ── Cert selector ── */
    .cert-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cert-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 12px;
      color: var(--text-secondary, #a09a92);
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .cert-item:hover {
      background: var(--bg-hover, #262522);
    }

    .cert-item.active {
      background: var(--accent-dim, rgba(212, 165, 116, 0.12));
      color: var(--accent, #d4a574);
    }

    .cert-code {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-size: 10px;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 3px;
      background: var(--bg-tertiary, #1e1d1b);
      color: var(--text-muted, #6b6560);
      flex-shrink: 0;
    }

    .cert-item.active .cert-code {
      background: rgba(212, 165, 116, 0.15);
      color: var(--accent, #d4a574);
    }

    .cert-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Mastery bars ── */
    .domain-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .domain-item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }

    .domain-name {
      font-size: 12px;
      color: var(--text-primary, #e8e4df);
      line-height: 1.3;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-right: 8px;
    }

    .domain-pct {
      font-size: 11px;
      font-weight: 600;
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      color: var(--text-secondary, #a09a92);
      flex-shrink: 0;
    }

    .bar-track {
      width: 100%;
      height: 4px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 2px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bar-fill.green { background: var(--success, #7a9e7e); }
    .bar-fill.yellow { background: var(--warning, #d4a574); }
    .bar-fill.red { background: var(--error, #c75f5f); }

    /* ── Sessions ── */
    .session-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .session-item {
      padding: 8px 10px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 6px;
      font-size: 12px;
    }

    .session-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
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

    /* ── Study modes ── */
    .mode-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mode-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
      font-size: 12px;
      color: var(--text-secondary, #a09a92);
      background: none;
      border: 1px solid var(--border, #2a2825);
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .mode-btn:hover {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
      color: var(--text-primary, #e8e4df);
    }

    .mode-icon {
      font-size: 14px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .mode-info {
      flex: 1;
      min-width: 0;
    }

    .mode-name {
      font-weight: 500;
      display: block;
      line-height: 1.3;
    }

    .mode-desc {
      font-size: 10px;
      color: var(--text-muted, #6b6560);
      display: block;
      line-height: 1.3;
      margin-top: 1px;
    }

    /* ── Empty ── */
    .empty {
      font-size: 12px;
      color: var(--text-muted, #6b6560);
      line-height: 1.5;
      padding: 2px 0;
    }

    .loading {
      font-size: 12px;
      color: var(--text-muted, #6b6560);
      padding: 2px 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.fetchCerts();
  }

  private async fetchCerts(): Promise<void> {
    try {
      const res = await fetch("/api/certs");
      this.certs = await res.json();
      if (this.certs.length > 0) {
        this.activeCert = this.certs[0].id;
        await this.fetchData();
      }
    } catch {
      // silently fail — sidebar is supplementary
    } finally {
      this.loading = false;
    }
  }

  private async fetchData(): Promise<void> {
    if (!this.activeCert) return;
    const gen = ++this.fetchGeneration;
    const [domainsRes, sessionsRes] = await Promise.all([
      fetch(`/api/domains?cert_id=${this.activeCert}`),
      fetch(`/api/sessions?cert_id=${this.activeCert}&limit=3`),
    ]);
    // Discard if a newer fetch was started while we were waiting
    if (gen !== this.fetchGeneration) return;
    this.domains = await domainsRes.json();
    this.sessions = await sessionsRes.json();
  }

  private async selectCert(id: string): Promise<void> {
    this.activeCert = id;
    await this.fetchData();
  }

  /** Refresh data — can be called externally after quiz answers */
  async refresh(): Promise<void> {
    await this.fetchData();
  }

  private barColor(value: number): string {
    if (value >= 70) return "green";
    if (value >= 40) return "yellow";
    return "red";
  }

  private selectMode(mode: string): void {
    this.dispatchEvent(
      new CustomEvent("mode-selected", {
        bubbles: true,
        composed: true,
        detail: { mode },
      }),
    );
  }

  private openSessionHistory(): void {
    this.dispatchEvent(
      new CustomEvent("open-session-history", {
        bubbles: true,
        composed: true,
        detail: { certId: this.activeCert },
      }),
    );
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

  render() {
    if (this.loading) {
      return html`<div class="section"><span class="loading">Loading...</span></div>`;
    }

    if (this.certs.length === 0) {
      return html`<div class="section"><span class="empty">No certifications loaded.</span></div>`;
    }

    return html`
      <!-- Study modes -->
      <div class="section">
        <div class="section-title">Study Modes</div>
        <div class="mode-list">
          <button class="mode-btn" @click=${() => this.selectMode("quiz")}>
            <span class="mode-icon">&#9997;</span>
            <span class="mode-info">
              <span class="mode-name">Quiz</span>
              <span class="mode-desc">10 questions on weak areas</span>
            </span>
          </button>
          <button class="mode-btn" @click=${() => this.selectMode("review")}>
            <span class="mode-icon">&#128218;</span>
            <span class="mode-info">
              <span class="mode-name">Review</span>
              <span class="mode-desc">Teach first, then test</span>
            </span>
          </button>
          <button class="mode-btn" @click=${() => this.selectMode("quick")}>
            <span class="mode-icon">&#9889;</span>
            <span class="mode-info">
              <span class="mode-name">Quick Check</span>
              <span class="mode-desc">3-5 fast questions</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Cert selector -->
      <div class="section">
        <div class="section-title">Certifications</div>
        <div class="cert-list">
          ${this.certs.map(c => html`
            <button
              class="cert-item ${c.id === this.activeCert ? "active" : ""}"
              @click=${() => this.selectCert(c.id)}
            >
              <span class="cert-code">${c.exam_code}</span>
              <span class="cert-name">${c.name}</span>
            </button>
          `)}
        </div>
      </div>

      <!-- Domain mastery -->
      <div class="section">
        <div class="section-title">Mastery</div>
        ${this.domains.length > 0
          ? html`
            <div class="domain-list">
              ${this.domains.map(d => html`
                <div class="domain-item">
                  <div class="domain-item-header">
                    <span class="domain-name">${d.name}</span>
                    <span class="domain-pct">${d.mastery_percentage}%</span>
                  </div>
                  <div class="bar-track">
                    <div
                      class="bar-fill ${this.barColor(d.mastery_percentage)}"
                      style="width: ${d.mastery_percentage}%"
                    ></div>
                  </div>
                </div>
              `)}
            </div>
          `
          : html`<span class="empty">No mastery data yet. Start studying to see progress.</span>`
        }
      </div>

      <!-- Recent sessions -->
      <div class="section">
        <div class="section-title">
          Recent Sessions
          ${this.sessions.length > 0
            ? html`<button class="view-all-btn" @click=${this.openSessionHistory}>View all</button>`
            : nothing
          }
        </div>
        ${this.sessions.length > 0
          ? html`
            <div class="session-list">
              ${this.sessions.map(s => html`
                <div class="session-item">
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
                </div>
              `)}
            </div>
          `
          : html`<span class="empty">No sessions recorded yet.</span>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sidebar-dashboard": SidebarDashboard;
  }
}
