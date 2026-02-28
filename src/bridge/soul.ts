import { readFileSync } from "node:fs";

/**
 * Reads a soul/prompt file and returns its contents, or empty string if missing.
 */
export function parseSoulFile(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}
