import { describe, it, expect } from "vitest";
import { Marked } from "marked";
import { preprocessStreaming, studyBlocksExtension } from "./marked-extensions.js";

describe("preprocessStreaming", () => {
  it("returns content unchanged when there are no fenced blocks", () => {
    const text = "Hello, this is a normal message.";
    expect(preprocessStreaming(text)).toBe(text);
  });

  it("replaces an incomplete quiz block with a skeleton placeholder", () => {
    const input = "Here is a quiz:\n\n```quiz\n{\"question\":\"Wha";
    const result = preprocessStreaming(input);
    expect(result).toContain("```quiz-loading");
    expect(result).not.toContain('"question"');
  });

  it("replaces a complete quiz block with a skeleton placeholder", () => {
    const input =
      "Here:\n\n```quiz\n" +
      '{"question":"What?","options":["A","B"],"correct":0}\n' +
      "```\n\nDone.";
    const result = preprocessStreaming(input);
    expect(result).toContain("```quiz-loading");
    expect(result).not.toContain('"question"');
    expect(result).toContain("Done.");
  });

  it("replaces multiple complete quiz blocks with skeletons", () => {
    const block =
      '```quiz\n{"question":"Q","options":["A"],"correct":0}\n```';
    const input = `First:\n\n${block}\n\nSecond:\n\n${block}\n\nEnd.`;
    const result = preprocessStreaming(input);
    // Both should be replaced
    const matches = result.match(/quiz-loading/g);
    expect(matches).toHaveLength(2);
    expect(result).not.toContain('"question"');
    expect(result).toContain("End.");
  });

  it("replaces mix of complete and incomplete quiz blocks", () => {
    const complete =
      '```quiz\n{"question":"Q1","options":["A"],"correct":0}\n```';
    const incomplete = '```quiz\n{"question":"Q2","opti';
    const input = `${complete}\n\n${incomplete}`;
    const result = preprocessStreaming(input);
    const matches = result.match(/quiz-loading/g);
    expect(matches).toHaveLength(2);
    expect(result).not.toContain('"question"');
  });

  it("replaces an incomplete progress block with a skeleton placeholder", () => {
    const input = "Progress:\n\n```progress\n{\"items\":[{\"la";
    const result = preprocessStreaming(input);
    expect(result).toContain("```progress-loading");
    expect(result).not.toContain('"items"');
  });

  it("leaves a complete progress block untouched for marked", () => {
    const input =
      "Progress:\n\n```progress\n" +
      '{"items":[{"label":"Topic","value":80}]}\n' +
      "```\n\nDone.";
    const result = preprocessStreaming(input);
    // Complete progress blocks should pass through (they render inline)
    expect(result).toContain('"items"');
    expect(result).not.toContain("progress-loading");
  });

  it("handles quiz and progress blocks in the same content", () => {
    const quiz =
      '```quiz\n{"question":"Q","options":["A"],"correct":0}\n```';
    const progress = '```progress\n{"items":[{"label":"T","value":50}]}';
    const input = `${quiz}\n\n${progress}`;
    const result = preprocessStreaming(input);
    // Quiz complete → skeleton, progress incomplete → skeleton
    expect(result).toContain("quiz-loading");
    expect(result).toContain("progress-loading");
  });

  it("preserves text before and after replaced blocks", () => {
    const input =
      "Before text\n\n```quiz\n" +
      '{"question":"Q","options":["A"],"correct":0}\n' +
      "```\n\nAfter text";
    const result = preprocessStreaming(input);
    expect(result).toContain("Before text");
    expect(result).toContain("After text");
  });

  it("does not touch regular code fences", () => {
    const input = "```js\nconsole.log('hello');\n```";
    expect(preprocessStreaming(input)).toBe(input);
  });
});

describe("studyBlocksExtension — quiz block validation", () => {
  const marked = new Marked(studyBlocksExtension());

  function render(md: string): string {
    return marked.parse(md) as string;
  }

  it("renders multiple_choice quiz block as quiz-block element", () => {
    const json = JSON.stringify({
      question: "What is 2+2?",
      options: ["3", "4", "5", "6"],
      correct: 1,
      objective_id: "test-1.1",
    });
    const result = render("```quiz\n" + json + "\n```");
    expect(result).toContain("<quiz-block");
    expect(result).toContain("data-config");
  });

  it("renders short_answer quiz block as quiz-block element", () => {
    const json = JSON.stringify({
      type: "short_answer",
      question: "What is DHCP?",
      answer: "Dynamic Host Configuration Protocol",
      objective_id: "1.1",
    });
    const result = render("```quiz\n" + json + "\n```");
    expect(result).toContain("<quiz-block");
    expect(result).toContain("data-config");
  });

  it("renders match quiz block as quiz-block element", () => {
    const json = JSON.stringify({
      type: "match",
      question: "Match protocols to ports",
      pairs: [["HTTP", "80"], ["SSH", "22"]],
      objective_id: "2.1",
    });
    const result = render("```quiz\n" + json + "\n```");
    expect(result).toContain("<quiz-block");
    expect(result).toContain("data-config");
  });

  it("falls back to pre/code for invalid short_answer (missing question)", () => {
    const json = JSON.stringify({
      type: "short_answer",
      answer: "something",
    });
    const result = render("```quiz\n" + json + "\n```");
    expect(result).toContain("<pre><code>");
    expect(result).not.toContain("<quiz-block");
  });

  it("falls back to pre/code for invalid match (missing pairs)", () => {
    const json = JSON.stringify({
      type: "match",
      question: "Match these",
    });
    const result = render("```quiz\n" + json + "\n```");
    expect(result).toContain("<pre><code>");
    expect(result).not.toContain("<quiz-block");
  });
});
