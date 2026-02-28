import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Marked } from "marked";
import { studyBlocksExtension } from "../../services/marked-extensions.js";
import "../blocks/quiz-block.js";
import "../blocks/progress-block.js";

const marked = new Marked();
marked.use(studyBlocksExtension());

@customElement("chat-message")
export class ChatMessage extends LitElement {
  @property() role: "user" | "agent" = "agent";
  @property() content = "";
  @property() userName = "You";

  static styles = css`
    :host {
      display: block;
      max-width: 800px;
      margin: 0 auto;
      padding: 14px 24px;
    }

    .role-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }

    .role-label.agent {
      color: var(--accent, #d4a574);
    }

    .role-label.user {
      color: var(--text-muted, #6b6560);
    }

    .body {
      font-size: 15px;
      line-height: 1.65;
      color: var(--text-primary, #e8e4df);
    }

    .body p {
      margin: 0 0 12px;
    }

    .body p:last-child {
      margin-bottom: 0;
    }

    /* Inline code */
    .body code {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
    }

    /* Code blocks */
    .body pre {
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
      margin: 14px 0;
    }

    .body pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Lists */
    .body ul,
    .body ol {
      margin: 8px 0 12px 20px;
    }

    .body li {
      margin-bottom: 4px;
    }

    .body li::marker {
      color: var(--text-muted, #6b6560);
    }

    /* Blockquote */
    .body blockquote {
      border-left: 2px solid var(--accent, #d4a574);
      padding-left: 14px;
      margin: 14px 0;
      color: var(--text-secondary, #a09a92);
      font-style: italic;
    }

    /* Links */
    .body a {
      color: var(--accent, #d4a574);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s ease;
    }

    .body a:hover {
      border-bottom-color: var(--accent, #d4a574);
    }

    /* Bold */
    .body strong {
      color: var(--text-primary, #e8e4df);
      font-weight: 600;
    }

    /* Headings */
    .body h1,
    .body h2,
    .body h3,
    .body h4 {
      color: var(--text-primary, #e8e4df);
      font-weight: 600;
      margin: 18px 0 8px;
      line-height: 1.3;
    }

    .body h1:first-child,
    .body h2:first-child,
    .body h3:first-child,
    .body h4:first-child {
      margin-top: 0;
    }

    .body h1 { font-size: 20px; }
    .body h2 { font-size: 17px; }
    .body h3 { font-size: 15px; }

    /* Tables */
    .body table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 14px;
    }

    .body th {
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary, #a09a92);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border, #2a2825);
    }

    .body td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border, #2a2825);
      color: var(--text-primary, #e8e4df);
    }

    .body tr:last-child td {
      border-bottom: none;
    }

    /* Horizontal rule */
    .body hr {
      border: none;
      height: 1px;
      background: var(--border, #2a2825);
      margin: 20px 0;
    }

    /* Emphasis */
    .body em {
      color: var(--text-secondary, #a09a92);
    }

    /* Skeleton placeholders for streaming blocks */
    .body .block-skeleton {
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
      margin: 14px 0;
    }

    .body .skeleton-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--text-muted, #6b6560);
      margin-bottom: 14px;
    }

    .body .skeleton-line {
      height: 12px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 6px;
      margin-bottom: 8px;
      animation: skeleton-pulse 1.6s ease-in-out infinite;
    }

    .body .skeleton-line:last-child {
      margin-bottom: 0;
    }

    .body .skeleton-bar {
      height: 6px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 14px;
    }

    .body .skeleton-bar:last-child {
      margin-bottom: 0;
    }

    .body .skeleton-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: var(--border, #2a2825);
      animation: skeleton-pulse 1.6s ease-in-out infinite;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
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

  render() {
    const roleLabel = this.role === "agent" ? "Sage" : this.userName;
    const parsed = marked.parse(this.content, { async: false });

    return html`
      <div class="role-label ${this.role}">${roleLabel}</div>
      <div class="body">${unsafeHTML(parsed)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessage;
  }
}
