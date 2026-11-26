// Mock connector (Gemini setup doc): replays seed/starter-pack.json into AXON, then acts as the Outbound Sender:
// every 10 s it reads approved actions from GET /api/outbox and confirms delivery (POST /api/outbox/:id/delivered),
// so they become "sent". Every request is signed: x-axon-signature = HMAC-SHA256(CONNECTOR_SECRET, timestamp + body).
// No Gemini here. Config: connectors/.env (AXON_URL, CONNECTOR_ID, CONNECTOR_SECRET).
// Run: npx tsx connectors/mock/replay.ts            (replay, then deliver until Ctrl+C)
//      npx tsx connectors/mock/replay.ts --once     (replay only)
//      npx tsx connectors/mock/replay.ts --outbox   (deliver only)
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHmac } from "crypto";

const envFile = join(__dirname, "..", ".env");
const env: Record<string, string> = {};
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
const AXON_URL = process.env.AXON_URL || env.AXON_URL || "http://localhost:3000";
const SECRET = process.env.CONNECTOR_SECRET || env.CONNECTOR_SECRET || "";
const CONNECTOR_ID = env.CONNECTOR_ID || "mock-mail";
const args = process.argv.slice(2);

/** Signed request to AXON. The signature covers the timestamp and the exact body sent. */
async function signed(method: "GET" | "POST", path: string, body?: unknown) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Date.now());
  const sig = createHmac("sha256", SECRET).update(ts + raw).digest("hex");
  return fetch(`${AXON_URL}${path}`, {
    method, body: raw || undefined,
    headers: { "content-type": "application/json", "x-axon-connector": CONNECTOR_ID, "x-axon-timestamp": ts, "x-axon-signature": sig },
  });
}

async function replay() {
  const pack = JSON.parse(readFileSync(join(__dirname, "..", "..", "seed", "starter-pack.json"), "utf8"));
  const res = await signed("POST", "/api/ingest/evidence", { items: pack.items });
  const out = await res.json().catch(() => ({}));
  console.log(`ingest: ${res.status} · accepted ${out.accepted ?? 0} · unmatched ${out.unmatched?.length ?? 0}`);
  if (out.pipeline) console.log(`pipeline: ${out.pipeline.flags_explained.length} new flag(s) explained by A2, ${out.pipeline.cases_assessed.length} case(s) reassessed by A3`);
  if (!res.ok) { console.error(out); process.exit(1); }
}

/** Outbound Sender: Teams and Outlook are simulated, so "delivering" is logging the message and confirming it. */
async function deliverOnce() {
  const res = await signed("GET", "/api/outbox");
  if (!res.ok) return console.error(`outbox: ${res.status} ${await res.text()}`);
  const items: { id: string; channel: string; recipient: string; subject?: string; body: string }[] = await res.json();
  for (const a of items) {
    console.log(`→ ${a.channel} to ${a.recipient}${a.subject ? ` · ${a.subject}` : ""}\n  ${a.body}`);
    const d = await signed("POST", `/api/outbox/${encodeURIComponent(a.id)}/delivered`);
    console.log(`  delivered: ${d.status}`);
  }
}

async function main() {
  if (!SECRET) console.warn("CONNECTOR_SECRET is empty: AXON accepts unsigned requests only in development.");
  if (!args.includes("--outbox")) await replay();
  if (args.includes("--once")) return;
  console.log(`Watching ${AXON_URL}/api/outbox every 10 s (Ctrl+C to stop)…`);
  for (;;) { await deliverOnce().catch((e) => console.error(String(e))); await new Promise((r) => setTimeout(r, 10_000)); }
}
main().catch((e) => { console.error(e); process.exit(1); });
