import { createBridgeServer } from "../src/bridge/server.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { StudyDatabase } from "../src/mcp/db.js";
import type { CertDefinition } from "../src/shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load .env manually to handle CRLF line endings on Windows.
// Node's --env-file flag doesn't strip \r, which silently breaks values.
const envPath = join(projectRoot, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const cleaned = line.replace(/\r$/, "").trim();
    if (!cleaned || cleaned.startsWith("#")) continue;
    const eqIdx = cleaned.indexOf("=");
    if (eqIdx === -1) continue;
    const key = cleaned.slice(0, eqIdx).trim();
    const value = cleaned.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} else {
  console.warn("No .env file found — copy .env.example to .env and add your token");
}

// Ensure soul.md exists (copy from example if missing)
const soulPath = join(projectRoot, "soul.md");
const soulExamplePath = join(projectRoot, "soul.example.md");
if (!existsSync(soulPath) && existsSync(soulExamplePath)) {
  copyFileSync(soulExamplePath, soulPath);
  console.log("Created soul.md from soul.example.md");
}

// Ensure data directory exists
mkdirSync(join(projectRoot, "data"), { recursive: true });

// Auto-import certs if DB is empty
const dbPath = join(projectRoot, "data", "study.db");
const certsDir = join(projectRoot, "data", "certs");
const db = new StudyDatabase(dbPath);
try {
  const existing = db.listCerts();
  if (existing.length === 0 && existsSync(certsDir)) {
    const certFiles = readdirSync(certsDir).filter(f => f.endsWith(".json"));
    for (const file of certFiles) {
      const cert: CertDefinition = JSON.parse(readFileSync(join(certsDir, file), "utf-8"));
      db.importCert(cert);
      console.log(`Imported cert: ${cert.name} (${cert.id})`);
    }
    if (certFiles.length === 0) {
      console.warn("No cert files found in data/certs/ — add .json cert files and restart");
    }
  }
} finally {
  db.close();
}

const port = parseInt(process.env.PORT ?? "3578", 10);
const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
  haiku: "claude-haiku-4-5",
};
const modelInput = process.env.CLAUDE_MODEL || "sonnet";
const model = MODEL_MAP[modelInput] ?? modelInput;
console.log(`Using model: ${model}${modelInput !== model ? ` (${modelInput})` : ""}`);

const { server, close } = await createBridgeServer({ port, model });
const addr = server.address() as { port: number };
console.log(`Bridge server listening on http://localhost:${addr.port}`);

// Start Vite dev server as a child process
const isWindows = process.platform === "win32";
const viteCmd = isWindows ? "npx.cmd" : "npx";
const vite = spawn(viteCmd, ["vite", "--config", "vite.config.ts"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

vite.on("error", (err) => {
  console.error("Failed to start Vite:", err.message);
});

console.log("Visit http://localhost:5173 to open the app");

// Graceful shutdown on SIGINT/SIGTERM
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down...`);
  vite.kill();
  await close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
