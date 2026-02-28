import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface CertInfo {
  id: string;
  name: string;
  exam_code: string;
  passing_score?: number;
  max_score?: number;
  time_minutes?: number;
  question_count?: number;
}

@customElement("welcome-screen")
export class WelcomeScreen extends LitElement {
  @property({ type: String }) userName = "";
  @property({ type: Boolean }) nameConfirmed = false;

  @property({ type: String }) lastCertId = "";

  @state() private certs: CertInfo[] = [];
  @state() private loading = true;
  @state() private inputName = "";

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: 0;
      padding: 40px 24px;
      overflow-y: auto;
    }

    .container {
      width: 100%;
      max-width: 560px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .brand {
      text-align: center;
    }

    .brand-name {
      font-family: var(--font-display, "Instrument Serif", serif);
      font-size: 48px;
      font-weight: 400;
      color: var(--accent, #d4a574);
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .brand-tag {
      font-size: 13px;
      color: var(--text-muted, #6b6560);
      letter-spacing: 0.06em;
      margin-top: 6px;
    }

    .name-card {
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
    }

    .name-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #e8e4df);
      margin-bottom: 10px;
    }

    .name-row {
      display: flex;
      gap: 8px;
    }

    .name-input {
      flex: 1;
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-primary, #e8e4df);
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .name-input:focus {
      border-color: var(--accent, #d4a574);
    }

    .name-input::placeholder {
      color: var(--text-muted, #6b6560);
    }

    .name-confirmed {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .name-value {
      font-size: 14px;
      color: var(--text-primary, #e8e4df);
      font-weight: 500;
    }

    .name-edit {
      background: none;
      border: none;
      color: var(--text-muted, #6b6560);
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 4px;
      transition: color 0.2s ease;
    }

    .name-edit:hover {
      color: var(--accent, #d4a574);
    }

    .section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
      margin-bottom: 12px;
    }

    .cert-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }

    .cert-card {
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      font-family: inherit;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cert-card:hover {
      border-color: var(--accent, #d4a574);
      background: var(--bg-hover, #262522);
    }

    .cert-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #e8e4df);
      line-height: 1.3;
    }

    .cert-code {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-size: 11px;
      color: var(--text-muted, #6b6560);
    }

    .cert-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary, #a09a92);
    }

    .cert-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .cert-stat-value {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-weight: 600;
      font-size: 11px;
    }

    .cert-start {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
      color: var(--accent, #d4a574);
      margin-top: auto;
    }

    .import-card {
      background: var(--bg-secondary, #161514);
      border: 1px dashed var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
      opacity: 0.5;
      cursor: not-allowed;
    }

    .import-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary, #a09a92);
      margin-bottom: 4px;
    }

    .import-desc {
      font-size: 12px;
      color: var(--text-muted, #6b6560);
    }

    .coming-soon {
      display: inline-block;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted, #6b6560);
      background: var(--bg-tertiary, #1e1d1b);
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 8px;
      vertical-align: middle;
    }

    .loading-text {
      text-align: center;
      color: var(--text-muted, #6b6560);
      font-size: 13px;
    }

    .continue-card {
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--accent, #d4a574);
      border-radius: 10px;
      padding: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      font-family: inherit;
      color: inherit;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .continue-card:hover {
      background: var(--bg-hover, #262522);
      border-color: var(--accent-hover, #e0b98e);
    }

    .continue-label {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #e8e4df);
    }

    .continue-cert {
      font-size: 13px;
      color: var(--accent, #d4a574);
    }

    .continue-arrow {
      font-size: 13px;
      font-weight: 500;
      color: var(--accent, #d4a574);
      margin-top: 4px;
    }

    .or-divider {
      text-align: center;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
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
    this.inputName = this.userName;
    this.fetchCerts();
  }

  private async fetchCerts(): Promise<void> {
    try {
      const res = await fetch("/api/certs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.certs = await res.json();
    } catch {
      // Silently fail
    } finally {
      this.loading = false;
    }
  }

  private handleNameInput(e: InputEvent): void {
    this.inputName = (e.target as HTMLInputElement).value;
  }

  private handleNameKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && this.inputName) {
      this.confirmName();
    }
  }

  private confirmName(): void {
    const trimmed = this.inputName.trim();
    if (!trimmed) return;
    this.dispatchEvent(
      new CustomEvent("name-confirmed", {
        bubbles: true,
        composed: true,
        detail: { name: trimmed },
      }),
    );
  }

  private editName(): void {
    this.dispatchEvent(
      new CustomEvent("name-edit", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private startSession(certId: string): void {
    if (!this.nameConfirmed && this.inputName) {
      this.confirmName();
    }

    this.dispatchEvent(
      new CustomEvent("start-session", {
        bubbles: true,
        composed: true,
        detail: { certId },
      }),
    );
  }

  private renderContinueCard() {
    if (!this.lastCertId || this.loading) return "";
    const cert = this.certs.find(c => c.id === this.lastCertId);
    if (!cert) return "";

    return html`
      <button class="continue-card" @click=${() => this.startSession(cert.id)}>
        <span class="continue-label">Continue studying</span>
        <span class="continue-cert">${cert.name}</span>
        <span class="continue-arrow">Pick up where you left off &rarr;</span>
      </button>
    `;
  }

  private renderNameSection() {
    if (this.nameConfirmed && this.userName) {
      return html`
        <div class="name-card">
          <div class="name-confirmed">
            <span class="name-value">Welcome back, ${this.userName}</span>
            <button class="name-edit" @click=${this.editName}>Edit</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="name-card">
        <div class="name-label">What should Sage call you?</div>
        <div class="name-row">
          <input
            class="name-input"
            type="text"
            placeholder="Your name"
            .value=${this.inputName}
            @input=${this.handleNameInput}
            @keydown=${this.handleNameKeydown}
          />
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="container">
        <div class="brand">
          <div class="brand-name">Sage</div>
          <div class="brand-tag">study tutor</div>
        </div>

        ${this.renderNameSection()}

        ${this.renderContinueCard()}

        <div>
          <div class="section-title">${this.lastCertId ? "Or choose a different certification" : "Choose your certification"}</div>
          ${this.loading
            ? html`<div class="loading-text">Loading certifications...</div>`
            : html`
              <div class="cert-grid">
                ${this.certs.map(c => html`
                  <button class="cert-card" @click=${() => this.startSession(c.id)}>
                    <div>
                      <div class="cert-name">${c.name}</div>
                      <div class="cert-code">${c.exam_code}</div>
                    </div>
                    ${c.question_count || c.time_minutes
                      ? html`
                        <div class="cert-stats">
                          ${c.question_count
                            ? html`<span class="cert-stat"><span class="cert-stat-value">${c.question_count}</span> questions</span>`
                            : ""}
                          ${c.time_minutes
                            ? html`<span class="cert-stat"><span class="cert-stat-value">${c.time_minutes}</span> min</span>`
                            : ""}
                        </div>
                      `
                      : ""}
                    <span class="cert-start">Start studying &rarr;</span>
                  </button>
                `)}
              </div>
              <div class="import-card" style="margin-top: 12px;">
                <div class="import-title">Import certification<span class="coming-soon">Coming soon</span></div>
                <div class="import-desc">Paste a Microsoft Learn URL to import exam objectives</div>
              </div>
            `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-screen": WelcomeScreen;
  }
}
