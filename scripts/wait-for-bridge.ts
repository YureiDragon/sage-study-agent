/**
 * Polls the bridge server health endpoint until it responds,
 * then exits. Used to delay Vite startup until the bridge is ready.
 */
const port = parseInt(process.env.PORT ?? "3578", 10);
const url = `http://localhost:${port}/health`;
const maxWait = 30_000;
const interval = 500;

const start = Date.now();

async function check(): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

while (Date.now() - start < maxWait) {
  if (await check()) {
    console.log(`Bridge server ready on port ${port}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, interval));
}

console.error(`Bridge server not ready after ${maxWait / 1000}s — starting Vite anyway`);
process.exit(0);
