import type { MarkedExtension, Tokens } from "marked";

/**
 * Escape a string for safe inclusion in an HTML attribute value.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape a string for safe inclusion in HTML text content.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render a `quiz` fenced code block as a `<quiz-block>` custom element.
 * Falls back to a `<pre><code>` block on parse error.
 */
function renderQuizBlock(json: string): string {
  try {
    const config = JSON.parse(json);
    const type = config.type ?? "multiple_choice";

    // Validate per type
    if (type === "short_answer") {
      if (typeof config.question !== "string")
        throw new Error("Invalid quiz config");
    } else if (type === "match") {
      if (
        typeof config.question !== "string" ||
        !Array.isArray(config.pairs)
      )
        throw new Error("Invalid quiz config");
    } else {
      // multiple_choice
      if (
        typeof config.question !== "string" ||
        !Array.isArray(config.options) ||
        typeof config.correct !== "number"
      ) {
        throw new Error("Invalid quiz config");
      }
    }

    const safeJson = escapeAttr(JSON.stringify(config));
    return `<quiz-block data-config="${safeJson}"></quiz-block>`;
  } catch {
    return `<pre><code>${escapeHtml(json)}</code></pre>`;
  }
}

/**
 * Render a `progress` fenced code block as a `<progress-block>` custom element.
 * Falls back to a `<pre><code>` block on parse error.
 */
function renderProgressBlock(json: string): string {
  try {
    const config = JSON.parse(json);
    // Validate required fields
    if (!Array.isArray(config.items)) {
      throw new Error("Invalid progress config");
    }
    const safeJson = escapeAttr(JSON.stringify(config));
    return `<progress-block data-config="${safeJson}"></progress-block>`;
  } catch {
    return `<pre><code>${escapeHtml(json)}</code></pre>`;
  }
}

/**
 * Skeleton HTML for a quiz block being generated during streaming.
 * Uses the same minimal box+pulse style as the progress skeleton.
 */
function renderQuizSkeleton(): string {
  return `<div class="block-skeleton quiz-skeleton">
    <div class="skeleton-label">Generating questions\u2026</div>
    <div class="skeleton-bars">
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:70%"></div></div>
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:50%"></div></div>
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:85%"></div></div>
    </div>
  </div>`;
}

/**
 * Skeleton HTML for a progress block being generated during streaming.
 */
function renderProgressSkeleton(): string {
  return `<div class="block-skeleton progress-skeleton">
    <div class="skeleton-label">Loading chart\u2026</div>
    <div class="skeleton-bars">
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:65%"></div></div>
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:40%"></div></div>
      <div class="skeleton-bar"><div class="skeleton-bar-fill" style="width:80%"></div></div>
    </div>
  </div>`;
}

/**
 * Pre-process streaming content to replace incomplete fenced code blocks
 * (with known language tags like `quiz` or `progress`) with placeholder
 * skeletons. This prevents raw JSON from being visible while Sage is
 * generating a structured block.
 *
 * Complete blocks (with a closing ```) are left untouched for marked to handle.
 */
export function preprocessStreaming(content: string): string {
  // First pass: replace ALL complete quiz fenced blocks with skeleton.
  // Quiz content always goes to the panel via quiz_set, so it should
  // never render inline during streaming — even when the fence is closed.
  content = content.replace(
    /```quiz\s*\n[\s\S]*?^```\s*$/gm,
    "```quiz-loading\n\n```",
  );

  // Second pass: handle the last incomplete fenced block (quiz or progress).
  const fencePattern = /```(quiz|progress)\s*\n/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(content)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) return content;

  // Check if there's a closing ``` after the opening fence
  const afterFence = content.slice(lastMatch.index + lastMatch[0].length);
  if (/^```\s*$/m.test(afterFence)) {
    // Block is closed — leave it for marked (progress renders inline)
    return content;
  }

  // Incomplete block — strip it and append a placeholder
  const before = content.slice(0, lastMatch.index);
  const lang = lastMatch[1] as "quiz" | "progress";
  const placeholder = `\`\`\`${lang}-loading\n\n\`\`\``;
  return before + placeholder;
}

/**
 * A marked extension that intercepts fenced code blocks with special language
 * identifiers (`quiz`, `progress`) and renders them as interactive custom
 * elements instead of plain `<pre><code>` blocks.
 *
 * Also handles `quiz-loading` and `progress-loading` placeholder blocks,
 * rendering them as skeleton UI during streaming.
 */
export function studyBlocksExtension(): MarkedExtension {
  return {
    renderer: {
      code({ text, lang }: Tokens.Code): string | false {
        if (lang === "quiz") return renderQuizBlock(text);
        if (lang === "progress") return renderProgressBlock(text);
        if (lang === "quiz-loading") return renderQuizSkeleton();
        if (lang === "progress-loading") return renderProgressSkeleton();
        return false; // fall through to default renderer
      },
    },
  };
}
