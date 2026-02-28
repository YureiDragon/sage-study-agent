import { describe, it, expect } from "vitest";
import { parseSoulFile } from "./soul.js";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("parseSoulFile", () => {
  it("returns empty string for missing file", () => {
    const result = parseSoulFile("/tmp/definitely-does-not-exist-abc123.txt");
    expect(result).toBe("");
  });

  it("returns file contents for existing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "soul-test-"));
    const filePath = join(dir, "soul.md");
    writeFileSync(filePath, "You are an exam coach.");
    try {
      const result = parseSoulFile(filePath);
      expect(result).toBe("You are an exam coach.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
