/**
 * import-cert.ts
 *
 * Reads a cert definition JSON file and imports it into the SQLite database.
 *
 * Usage: tsx scripts/import-cert.ts <path-to-cert.json>
 *
 * The database path defaults to data/study.db but can be overridden with
 * the STUDY_DB_PATH environment variable.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CertDefinition } from "../src/shared/types.js";
import { StudyDatabase } from "../src/mcp/db.js";

// ── Main ───────────────────────────────────────────────────────────

function importCert(certPath: string): void {
  const raw = readFileSync(certPath, "utf-8");
  const cert: CertDefinition = JSON.parse(raw);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dbPath =
    process.env.STUDY_DB_PATH ?? resolve(__dirname, "..", "data", "study.db");

  console.log(`Importing cert "${cert.name}" (${cert.id}) into ${dbPath}`);

  const db = new StudyDatabase(dbPath);
  try {
    db.importCert(cert);
    console.log(
      `Successfully imported: ${cert.domains.length} domains, ${cert.objectives.length} objectives`
    );
  } finally {
    db.close();
  }
}

// ── CLI entry ──────────────────────────────────────────────────────

const certPath = process.argv[2];
if (!certPath) {
  console.error("Usage: tsx scripts/import-cert.ts <path-to-cert.json>");
  process.exit(1);
}

importCert(resolve(certPath));
