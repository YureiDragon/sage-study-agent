/**
 * convert-aplus.ts
 *
 * Reads the aPlusStudy objectives.json and outputs standard cert definition
 * JSON files into data/certs/.
 *
 * Usage: tsx scripts/convert-aplus.ts <path-to-objectives.json>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CertDefinition } from "../src/shared/types.js";

// ── Input types (aPlusStudy format) ────────────────────────────────

interface AplusObjective {
  id: string;
  title: string;
  subtopics: string[];
  studyNotes?: string;
}

interface AplusDomain {
  id: string;
  name: string;
  weight: number;
  objectives: AplusObjective[];
}

interface AplusExam {
  exam: string;
  examCode: string;
  passingScore: number;
  maxScore: number;
  totalQuestions: number;
  timeMinutes: number;
  domains: AplusDomain[];
}

interface AplusData {
  exams: AplusExam[];
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Derive a cert ID from the exam code.
 * "220-1201" -> "comptia-aplus-1201"
 */
function certIdFromCode(examCode: string): string {
  const suffix = examCode.replace("220-", "");
  return `comptia-aplus-${suffix}`;
}

/**
 * Build a human-readable cert name.
 * ("Core 1", "220-1201") -> "CompTIA A+ Core 1 (220-1201)"
 */
function certName(examName: string, examCode: string): string {
  return `CompTIA A+ ${examName} (${examCode})`;
}

/**
 * Parse the domain number from the domain ID string.
 * "1.0" -> 1, "2.0" -> 2
 */
function domainNumber(domainId: string): number {
  return parseInt(domainId.split(".")[0], 10);
}

/**
 * Build a globally-unique objective ID from the exam code suffix and objective id.
 * ("1201", "1.1") -> "aplus-1201-1.1"
 */
function objectiveId(examCodeSuffix: string, rawId: string): string {
  return `aplus-${examCodeSuffix}-${rawId}`;
}

// ── Main ───────────────────────────────────────────────────────────

function convert(inputPath: string): void {
  const raw = readFileSync(inputPath, "utf-8");
  const data: AplusData = JSON.parse(raw);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(__dirname, "..", "data", "certs");
  mkdirSync(outDir, { recursive: true });

  for (const exam of data.exams) {
    const id = certIdFromCode(exam.examCode);
    const codeSuffix = exam.examCode.replace("220-", "");

    const cert: CertDefinition = {
      id,
      name: certName(exam.exam, exam.examCode),
      exam_code: exam.examCode,
      passing_score: exam.passingScore,
      max_score: exam.maxScore,
      time_minutes: exam.timeMinutes,
      question_count: exam.totalQuestions,
      domains: exam.domains.map((d) => ({
        number: domainNumber(d.id),
        name: d.name,
        weight: d.weight,
      })),
      objectives: exam.domains.flatMap((d) =>
        d.objectives.map((o) => ({
          id: objectiveId(codeSuffix, o.id),
          domain: domainNumber(d.id),
          title: o.title,
          subtopics: o.subtopics,
        }))
      ),
    };

    const outPath = resolve(outDir, `${id}.json`);
    writeFileSync(outPath, JSON.stringify(cert, null, 2) + "\n", "utf-8");
    console.log(`Wrote ${outPath}`);
    console.log(
      `  ${cert.domains.length} domains, ${cert.objectives.length} objectives`
    );
  }
}

// ── CLI entry ──────────────────────────────────────────────────────

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: tsx scripts/convert-aplus.ts <path-to-objectives.json>");
  process.exit(1);
}

convert(resolve(inputPath));
