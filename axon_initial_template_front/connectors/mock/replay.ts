// Mock connector: replays seed/starter-pack.json into AXON. No Gemini here.
// Config: connectors/.env (AXON_URL, CONNECTOR_ID, CONNECTOR_SECRET). Run: npx tsx connectors/mock/replay.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const envFile = join(__dirname, "..", ".env");
const env: Record<string, string> = {};
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const AXON_URL = env.AXON_URL || process.env.AXON_URL || "http://localhost:3000";
const CONNECTOR_SECRET = env.CONNECTOR_SECRET || process.env.CONNECTOR_SECRET || "";
const CONNECTOR_ID = env.CONNECTOR_ID || "mock-mail";

async function main() {
  const pack = JSON.parse(readFileSync(join(__dirname, "..", "..", "seed", "starter-pack.json"), "utf8"));
  const res = await fetch(`${AXON_URL}/api/ingest/evidence`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-axon-secret": CONNECTOR_SECRET, "x-axon-connector": CONNECTOR_ID },
    body: JSON.stringify({ items: pack.items }),
  });
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
