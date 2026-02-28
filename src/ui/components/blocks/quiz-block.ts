import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface QuizConfig {
  question: string;
  options: string[];
  correct: number;
  objective_id?: string;
}

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

@customElement("quiz-block")
export class QuizBlock extends LitElement {
  @property({ type: String }) question = "";
  @property({ type: Array }) options: string[] = [];
  @property({ type: Number }) correct = 0;
  @property({ attribute: "objective-id" }) objectiveId = "";

  @state() private selected: number | null = null;
  @state() private revealed = false;

  static styles = css`
    :host {
      display: block;
      background: var(--bg-secondary, #161514);
      border: 1px solid var(--border, #2a2825);
      border-radius: 10px;
      padding: 20px;
      margin: 14px 0;
    }

    .question {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary, #e8e4df);
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-primary, #e8e4df);
      font-size: 14px;
      line-height: 1.4;
    }

    .option:hover:not(.disabled) {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
    }

    .option.disabled {
      cursor: default;
    }

    .option.correct {
      background: var(--accent-sage-dim, rgba(122, 158, 126, 0.12));
      border-color: var(--success, #7a9e7e);
    }

    .option.incorrect {
      background: rgba(199, 95, 95, 0.12);
      border-color: var(--error, #c75f5f);
    }

    .option-label {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 5px;
      background: var(--bg-primary, #0d0d0c);
      font-weight: 600;
      font-size: 12px;
      flex-shrink: 0;
      color: var(--text-secondary, #a09a92);
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      transition: all 0.2s ease;
    }

    .option.correct .option-label {
      background: var(--success, #7a9e7e);
      color: var(--bg-primary, #0d0d0c);
    }

    .option.incorrect .option-label {
      background: var(--error, #c75f5f);
      color: var(--bg-primary, #0d0d0c);
    }

    .option-text {
      flex: 1;
    }

    .objective-tag {
      margin-top: 14px;
      font-size: 11px;
      color: var(--text-muted, #6b6560);
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      letter-spacing: 0.02em;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const configAttr = this.getAttribute("data-config");
    if (configAttr) {
      try {
        const config: QuizConfig = JSON.parse(configAttr);
        this.question = config.question ?? this.question;
        this.options = config.options ?? this.options;
        this.correct = config.correct ?? this.correct;
        this.objectiveId = config.objective_id ?? this.objectiveId;
      } catch {
        // data-config was not valid JSON; keep existing properties
      }
    }
  }

  private handleSelect(index: number): void {
    if (this.revealed) return;

    this.selected = index;
    this.revealed = true;

    this.dispatchEvent(
      new CustomEvent("answer-selected", {
        bubbles: true,
        composed: true,
        detail: {
          selected: index,
          correct: this.correct,
          isCorrect: index === this.correct,
          objectiveId: this.objectiveId,
        },
      }),
    );
  }

  private optionClass(index: number): string {
    const classes = ["option"];
    if (this.revealed) {
      classes.push("disabled");
      if (index === this.correct) {
        classes.push("correct");
      } else if (index === this.selected) {
        classes.push("incorrect");
      }
    }
    return classes.join(" ");
  }

  render() {
    return html`
      <div class="question">${this.question}</div>
      <div class="options">
        ${this.options.map(
          (opt, i) => html`
            <div
              class=${this.optionClass(i)}
              @click=${() => this.handleSelect(i)}
            >
              <span class="option-label">${OPTION_LABELS[i] ?? i + 1}</span>
              <span class="option-text">${opt}</span>
            </div>
          `,
        )}
      </div>
      ${this.objectiveId
        ? html`<div class="objective-tag">Objective ${this.objectiveId}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quiz-block": QuizBlock;
  }
}
