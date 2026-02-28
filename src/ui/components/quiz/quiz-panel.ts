import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface QuizQuestionBase {
  id: number;
  objectiveId?: string;
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: "multiple_choice";
  text: string;
  options: string[];
  correct: number;
}

export interface ShortAnswerQuestion extends QuizQuestionBase {
  type: "short_answer";
  text: string;
  answer: string;
}

export interface MatchQuestion extends QuizQuestionBase {
  type: "match";
  text: string;
  pairs: [string, string][];
}

export type QuizQuestion = MultipleChoiceQuestion | ShortAnswerQuestion | MatchQuestion;

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

@customElement("quiz-panel")
export class QuizPanel extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private questions: QuizQuestion[] = [];
  @state() private currentIndex = 0;
  @state() private answers: Map<number, number | string | Map<number, number>> = new Map();
  @state() private submitted = false;
  @state() private shuffledDefs: Map<number, string[]> = new Map();
  @state() private selectedTerm: number | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 420px;
      max-width: 100%;
      background: var(--bg-secondary, #161514);
      border-left: 1px solid var(--border, #2a2825);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 100;
      display: flex;
      flex-direction: column;
    }

    :host([open]) {
      transform: translateX(0);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border, #2a2825);
    }

    .header-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent, #d4a574);
    }

    .header-progress {
      font-size: 12px;
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      color: var(--text-muted, #6b6560);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-muted, #6b6560);
      cursor: pointer;
      font-size: 18px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.2s ease;
      line-height: 1;
    }

    .close-btn:hover {
      color: var(--text-primary, #e8e4df);
    }

    .body {
      flex: 1;
      overflow-y: auto;
      padding: 24px 20px;
    }

    .question-number {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
      margin-bottom: 10px;
    }

    .question-text {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary, #e8e4df);
      line-height: 1.6;
      margin-bottom: 20px;
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
      text-align: left;
      font-family: inherit;
      width: 100%;
    }

    .option:hover:not(.selected):not(.disabled) {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
    }

    .option.selected {
      border-color: var(--accent, #d4a574);
      background: var(--accent-dim, rgba(212, 165, 116, 0.12));
    }

    .option.correct {
      border-color: var(--success, #7a9e7e);
      background: var(--accent-sage-dim, rgba(122, 158, 126, 0.12));
    }

    .option.incorrect {
      border-color: var(--error, #c75f5f);
      background: rgba(199, 95, 95, 0.12);
    }

    .option.disabled {
      cursor: default;
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

    .option.selected .option-label {
      background: var(--accent, #d4a574);
      color: var(--bg-primary, #0d0d0c);
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
      margin-top: 16px;
      font-size: 11px;
      color: var(--text-muted, #6b6560);
      font-family: var(--font-mono, "JetBrains Mono", monospace);
    }

    .footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border, #2a2825);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .nav-btn {
      padding: 7px 16px;
      background: none;
      border: 1px solid var(--border, #2a2825);
      border-radius: 6px;
      color: var(--text-secondary, #a09a92);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    .nav-btn:hover:not(:disabled) {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
      color: var(--text-primary, #e8e4df);
    }

    .nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .submit-btn {
      padding: 7px 20px;
      background: var(--accent, #d4a574);
      border: none;
      border-radius: 6px;
      color: var(--bg-primary, #0d0d0c);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      transition: background 0.2s ease;
    }

    .submit-btn:hover {
      background: var(--accent-hover, #e0b98e);
    }

    .submit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .dots {
      display: flex;
      gap: 4px;
      justify-content: center;
      flex: 1;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--border, #2a2825);
      transition: background 0.2s ease;
    }

    .dot.answered {
      background: var(--text-muted, #6b6560);
    }

    .dot.current {
      background: var(--accent, #d4a574);
    }

    .dot.correct-dot {
      background: var(--success, #7a9e7e);
    }

    .dot.incorrect-dot {
      background: var(--error, #c75f5f);
    }

    .short-answer-input {
      width: 100%;
      padding: 12px 14px;
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      border-radius: 8px;
      color: var(--text-primary, #e8e4df);
      font-size: 14px;
      font-family: inherit;
      line-height: 1.5;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    .short-answer-input:focus {
      outline: none;
      border-color: var(--accent, #d4a574);
    }

    .short-answer-input:read-only {
      opacity: 0.7;
      cursor: default;
    }

    .short-answer-hint {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-muted, #6b6560);
      font-style: italic;
    }

    .match-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .match-column-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted, #6b6560);
      margin-bottom: 6px;
    }

    .match-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-tertiary, #1e1d1b);
      border: 1px solid var(--border, #2a2825);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-primary, #e8e4df);
      transition: all 0.15s ease;
      font-family: inherit;
      text-align: left;
      width: 100%;
    }

    .match-item:hover:not(.disabled) {
      background: var(--bg-hover, #262522);
      border-color: var(--border-light, #353230);
    }

    .match-item.active {
      border-color: var(--accent, #d4a574);
      background: var(--accent-dim, rgba(212, 165, 116, 0.12));
    }

    .match-item.paired {
      border-color: var(--text-muted, #6b6560);
    }

    .match-item.correct {
      border-color: var(--success, #7a9e7e);
      background: var(--accent-sage-dim, rgba(122, 158, 126, 0.12));
    }

    .match-item.incorrect {
      border-color: var(--error, #c75f5f);
      background: rgba(199, 95, 95, 0.12);
    }

    .match-item.disabled {
      cursor: default;
    }

    .match-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background: var(--bg-primary, #0d0d0c);
      font-size: 10px;
      font-weight: 600;
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      color: var(--text-muted, #6b6560);
      flex-shrink: 0;
    }

    .match-item.paired .match-badge,
    .match-item.active .match-badge {
      background: var(--accent, #d4a574);
      color: var(--bg-primary, #0d0d0c);
    }

    .match-item.correct .match-badge {
      background: var(--success, #7a9e7e);
      color: var(--bg-primary, #0d0d0c);
    }

    .match-item.incorrect .match-badge {
      background: var(--error, #c75f5f);
      color: var(--bg-primary, #0d0d0c);
    }

    .match-items {
      display: flex;
      flex-direction: column;
      gap: 6px;
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

  loadQuestions(questions: QuizQuestion[]): void {
    // Normalize match pairs to [["term","def"],...] tuples.
    // Sage may send pairs in various formats:
    //   - {"term":"def",...}                            → Object.entries
    //   - [{term:"x",definition:"y"},...]               → extract first two values
    //   - [["term","def"],...]                          → already correct
    this.questions = questions.map((q) => {
      if (q.type !== "match" || !q.pairs) return q;

      let normalized: [string, string][];

      if (!Array.isArray(q.pairs)) {
        // Plain object like {"HTTP":"80","HTTPS":"443"}
        normalized = Object.entries(q.pairs as Record<string, string>);
      } else if (
        q.pairs.length > 0 &&
        typeof q.pairs[0] === "object" &&
        !Array.isArray(q.pairs[0])
      ) {
        // Array of objects like [{term:"HTTP",definition:"80"},...]
        normalized = (q.pairs as unknown as Record<string, string>[]).map((obj) => {
          const vals = Object.values(obj);
          return [String(vals[0] ?? ""), String(vals[1] ?? "")] as [string, string];
        });
      } else {
        // Already tuples or close enough
        normalized = (q.pairs as unknown as (string | [string, string])[]).map((p) =>
          Array.isArray(p)
            ? [String(p[0] ?? ""), String(p[1] ?? "")] as [string, string]
            : [String(p), ""] as [string, string]
        );
      }

      return { ...q, pairs: normalized };
    });
    this.currentIndex = 0;
    this.answers = new Map();
    this.submitted = false;
    this.selectedTerm = null;
    this.open = true;

    // Pre-shuffle definitions for match questions
    const shuffled = new Map<number, string[]>();
    for (const q of this.questions) {
      if (q.type === "match") {
        const defs = q.pairs.map(([, d]) => d);
        // Fisher-Yates shuffle
        for (let i = defs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [defs[i], defs[j]] = [defs[j], defs[i]];
        }
        shuffled.set(q.id, defs);
      }
    }
    this.shuffledDefs = shuffled;
  }

  closePanel = (): void => {
    this.open = false;
    // If quiz was already submitted, clear state on close (full lifecycle complete).
    // Otherwise preserve state so the user can re-open.
    if (this.submitted) {
      this.questions = [];
      this.currentIndex = 0;
      this.answers = new Map();
      this.submitted = false;
    }
  };

  reopenPanel(): void {
    if (this.questions.length > 0) {
      this.open = true;
    }
  }

  get hasQuiz(): boolean {
    return this.questions.length > 0;
  }

  private selectOption(index: number): void {
    if (this.submitted) return;
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const updated = new Map(this.answers);
    updated.set(q.id, index);
    this.answers = updated;
  }

  private goNext = (): void => {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.selectedTerm = null;
    }
  };

  private goPrev = (): void => {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.selectedTerm = null;
    }
  };

  private submit = (): void => {
    this.submitted = true;

    const answerArray = this.questions.map((q) => {
      if (q.type === "short_answer") {
        return {
          questionId: q.id,
          type: "short_answer" as const,
          text: (this.answers.get(q.id) as string) ?? "",
        };
      }
      if (q.type === "match") {
        const matchAnswers = this.answers.get(q.id) as Map<number, number> | undefined;
        const pairs: Record<string, string> = {};
        if (matchAnswers) {
          for (const [termIdx, defIdx] of matchAnswers) {
            const shuffledDefs = this.shuffledDefs.get(q.id);
            pairs[q.pairs[termIdx][0]] = shuffledDefs?.[defIdx] ?? "";
          }
        }
        return {
          questionId: q.id,
          type: "match" as const,
          pairs,
        };
      }
      return {
        questionId: q.id,
        type: "multiple_choice" as const,
        selected: (this.answers.get(q.id) as number) ?? -1,
      };
    });

    this.dispatchEvent(
      new CustomEvent("quiz-submitted", {
        bubbles: true,
        composed: true,
        detail: { answers: answerArray },
      }),
    );
  };

  private optionClass(optIndex: number, question: MultipleChoiceQuestion): string {
    const classes = ["option"];
    const selected = this.answers.get(question.id);

    if (this.submitted) {
      classes.push("disabled");
      if (optIndex === question.correct) {
        classes.push("correct");
      } else if (optIndex === selected) {
        classes.push("incorrect");
      }
    } else if (optIndex === selected) {
      classes.push("selected");
    }
    return classes.join(" ");
  }

  private dotClass(i: number): string {
    const q = this.questions[i];
    if (!q) return "dot";

    if (this.submitted) {
      if (q.type === "short_answer") {
        return this.answers.has(q.id) ? "dot answered" : "dot";
      }
      if (q.type === "match") {
        const matchAns = this.answers.get(q.id) as Map<number, number> | undefined;
        if (!matchAns) return "dot";
        const defs = this.shuffledDefs.get(q.id) ?? [];
        const allCorrect = [...matchAns.entries()].every(
          ([tIdx, dIdx]) => defs[dIdx] === q.pairs[tIdx][1]
        );
        return allCorrect ? "dot correct-dot" : "dot incorrect-dot";
      }
      // multiple_choice
      const selected = this.answers.get(q.id) as number | undefined;
      if (selected === q.correct) return "dot correct-dot";
      if (selected !== undefined) return "dot incorrect-dot";
      return "dot";
    }

    if (i === this.currentIndex) return "dot current";
    if (this.answers.has(q.id)) return "dot answered";
    return "dot";
  }

  private handleShortAnswer = (e: Event): void => {
    if (this.submitted) return;
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const value = (e.target as HTMLTextAreaElement).value;
    const updated = new Map(this.answers);
    updated.set(q.id, value);
    this.answers = updated;
  };

  private selectTerm(termIndex: number): void {
    if (this.submitted) return;
    const q = this.questions[this.currentIndex];
    if (!q || q.type !== "match") return;

    if (this.selectedTerm === termIndex) {
      this.selectedTerm = null;
      return;
    }

    // If this term is already paired, unpair it
    const matchAns = (this.answers.get(q.id) as Map<number, number>) ?? new Map();
    if (matchAns.has(termIndex)) {
      const updated = new Map(this.answers);
      const newMatch = new Map(matchAns);
      newMatch.delete(termIndex);
      updated.set(q.id, newMatch);
      this.answers = updated;
      this.selectedTerm = null;
      return;
    }

    this.selectedTerm = termIndex;
  }

  private selectDef(defIndex: number): void {
    if (this.submitted || this.selectedTerm === null) return;
    const q = this.questions[this.currentIndex];
    if (!q || q.type !== "match") return;

    // Check if this def is already taken
    const matchAns = (this.answers.get(q.id) as Map<number, number>) ?? new Map();
    for (const [, d] of matchAns) {
      if (d === defIndex) return;
    }

    const updated = new Map(this.answers);
    const newMatch = new Map(matchAns);
    newMatch.set(this.selectedTerm, defIndex);
    updated.set(q.id, newMatch);
    this.answers = updated;
    this.selectedTerm = null;
  }

  private renderQuestion(q: QuizQuestion) {
    if (q.type === "short_answer") {
      return html`
        <div class="question-number">Question ${this.currentIndex + 1}</div>
        <div class="question-text">${q.text}</div>
        <textarea
          class="short-answer-input"
          placeholder="Type your answer..."
          .value=${(this.answers.get(q.id) as string) ?? ""}
          @input=${this.handleShortAnswer}
          ?readonly=${this.submitted}
        ></textarea>
        ${this.submitted
          ? html`<div class="short-answer-hint">Claude will judge your answer in chat.</div>`
          : nothing
        }
        ${q.objectiveId
          ? html`<div class="objective-tag">Objective ${q.objectiveId}</div>`
          : nothing}
      `;
    }

    if (q.type === "match") {
      return this.renderMatch(q);
    }

    // multiple_choice (default)
    return html`
      <div class="question-number">Question ${this.currentIndex + 1}</div>
      <div class="question-text">${q.text}</div>
      <div class="options">
        ${q.options.map(
          (opt, i) => html`
            <button
              class=${this.optionClass(i, q)}
              @click=${() => this.selectOption(i)}
            >
              <span class="option-label">${LABELS[i] ?? i + 1}</span>
              <span class="option-text">${opt}</span>
            </button>
          `,
        )}
      </div>
      ${q.objectiveId
        ? html`<div class="objective-tag">Objective ${q.objectiveId}</div>`
        : nothing}
    `;
  }

  private renderMatch(q: MatchQuestion) {
    if (!Array.isArray(q.pairs) || q.pairs.length === 0) {
      return html`
        <div class="question-number">Question ${this.currentIndex + 1}</div>
        <div class="question-text">${q.text}</div>
        <div class="short-answer-hint">Match question has no pairs to display.</div>
      `;
    }
    const defs = this.shuffledDefs.get(q.id) ?? [];
    const matchAns = (this.answers.get(q.id) as Map<number, number>) ?? new Map();
    const MATCH_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8"];

    const termClass = (tIdx: number): string => {
      const classes = ["match-item"];
      if (this.submitted) {
        classes.push("disabled");
        if (matchAns.has(tIdx)) {
          const dIdx = matchAns.get(tIdx)!;
          const isCorrect = defs[dIdx] === q.pairs[tIdx][1];
          classes.push(isCorrect ? "correct" : "incorrect");
        }
      } else if (this.selectedTerm === tIdx) {
        classes.push("active");
      } else if (matchAns.has(tIdx)) {
        classes.push("paired");
      }
      return classes.join(" ");
    };

    const defClass = (dIdx: number): string => {
      const classes = ["match-item"];
      if (this.submitted) {
        classes.push("disabled");
        for (const [tIdx, d] of matchAns) {
          if (d === dIdx) {
            const isCorrect = defs[dIdx] === q.pairs[tIdx][1];
            classes.push(isCorrect ? "correct" : "incorrect");
            break;
          }
        }
      } else {
        for (const [, d] of matchAns) {
          if (d === dIdx) { classes.push("paired"); break; }
        }
      }
      return classes.join(" ");
    };

    const defBadge = (dIdx: number): string => {
      for (const [tIdx, d] of matchAns) {
        if (d === dIdx) return MATCH_LABELS[tIdx] ?? "";
      }
      return "";
    };

    return html`
      <div class="question-number">Question ${this.currentIndex + 1}</div>
      <div class="question-text">${q.text}</div>
      <div class="match-container">
        <div>
          <div class="match-column-label">Terms</div>
          <div class="match-items">
            ${q.pairs.map(([term], tIdx) => html`
              <button
                class=${termClass(tIdx)}
                @click=${() => this.selectTerm(tIdx)}
              >
                <span class="match-badge">${MATCH_LABELS[tIdx]}</span>
                <span>${term}</span>
              </button>
            `)}
          </div>
        </div>
        <div>
          <div class="match-column-label">Definitions</div>
          <div class="match-items">
            ${defs.map((def, dIdx) => html`
              <button
                class=${defClass(dIdx)}
                @click=${() => this.selectDef(dIdx)}
              >
                ${defBadge(dIdx)
                  ? html`<span class="match-badge">${defBadge(dIdx)}</span>`
                  : html`<span class="match-badge">&nbsp;</span>`
                }
                <span>${def}</span>
              </button>
            `)}
          </div>
        </div>
      </div>
      ${q.objectiveId
        ? html`<div class="objective-tag">Objective ${q.objectiveId}</div>`
        : nothing}
    `;
  }

  render() {
    if (this.questions.length === 0) return nothing;

    const q = this.questions[this.currentIndex];
    if (!q) return nothing;

    const allAnswered = this.questions.every((q) => {
      const ans = this.answers.get(q.id);
      if (q.type === "short_answer") return typeof ans === "string" && ans.trim().length > 0;
      if (q.type === "match") return ans instanceof Map && ans.size === q.pairs.length;
      return ans !== undefined;
    });
    const isFirst = this.currentIndex === 0;
    const isLast = this.currentIndex === this.questions.length - 1;

    return html`
      <div class="header">
        <span class="header-title">Quiz</span>
        <span class="header-progress">${this.currentIndex + 1} / ${this.questions.length}</span>
        <button class="close-btn" @click=${this.closePanel} aria-label="Close quiz panel">&times;</button>
      </div>

      <div class="body">
        ${this.renderQuestion(q)}
      </div>

      <div class="footer">
        <button class="nav-btn" ?disabled=${isFirst} @click=${this.goPrev}>Prev</button>
        <div class="dots">
          ${this.questions.map((_, i) => html`<span class=${this.dotClass(i)}></span>`)}
        </div>
        ${this.submitted
          ? html`<button class="nav-btn" @click=${this.closePanel}>Close</button>`
          : isLast && allAnswered
            ? html`<button class="submit-btn" @click=${this.submit}>Submit</button>`
            : html`<button class="nav-btn" ?disabled=${isLast} @click=${this.goNext}>Next</button>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quiz-panel": QuizPanel;
  }
}
