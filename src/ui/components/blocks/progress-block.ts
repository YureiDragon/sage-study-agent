import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface ProgressItem {
  label: string;
  value: number;
}

interface ProgressConfig {
  title?: string;
  items: ProgressItem[];
}

@customElement("progress-block")
export class ProgressBlock extends LitElement {
  @property({ type: Array }) items: ProgressItem[] = [];
  @property({ type: String }) title = "";

  static styles = css`
    :host {
      display: block;
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
      margin: 14px 0;
    }

    .title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #e8e4df);
      margin-bottom: 16px;
      line-height: 1.4;
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
    }

    .item-label {
      font-size: 13px;
      color: var(--text-primary, #e8e4df);
      line-height: 1.4;
    }

    .item-percent {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #a09a92);
      font-family: var(--font-mono, "JetBrains Mono", monospace);
    }

    .bar-track {
      width: 100%;
      height: 6px;
      background: var(--bg-tertiary, #1e1d1b);
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bar-fill.green {
      background: var(--success, #7a9e7e);
    }

    .bar-fill.yellow {
      background: var(--warning, #d4a574);
    }

    .bar-fill.red {
      background: var(--error, #c75f5f);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const configAttr = this.getAttribute("data-config");
    if (configAttr) {
      try {
        const config: ProgressConfig = JSON.parse(configAttr);
        this.title = config.title ?? this.title;
        this.items = config.items ?? this.items;
      } catch {
        // data-config was not valid JSON; keep existing properties
      }
    }
  }

  private barColor(value: number): string {
    if (value >= 70) return "green";
    if (value >= 40) return "yellow";
    return "red";
  }

  render() {
    return html`
      ${this.title
        ? html`<div class="title">${this.title}</div>`
        : nothing}
      <div class="items">
        ${this.items.map(
          (item) => html`
            <div class="item">
              <div class="item-header">
                <span class="item-label">${item.label}</span>
                <span class="item-percent">${Math.round(item.value)}%</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill ${this.barColor(item.value)}"
                  style="width: ${Math.min(100, Math.max(0, item.value))}%"
                ></div>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "progress-block": ProgressBlock;
  }
}
