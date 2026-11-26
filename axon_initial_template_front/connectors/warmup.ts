// Demo warm-up (brief, build order step 5): pre-run the agents on the seed so their answers sit in ai_cache.
// During the demo the same clicks then answer instantly, even if Gemini is slow or over quota.
// Run with the app up: npx tsx connectors/warmup.ts   (AXON_URL from connectors/.env, default http://localhost:3000)
// Only proposals are written (A2 causes, A3 levels), exactly as when a person clicks the buttons.
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const env: Record<string, string> = {};
const f = join(__dirname, ".env");
if (existsSync(f)) for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
const URL = process.env.AXON_URL || env.AXON_URL || "http://localhost:3000";

async function post(path: string, body: unknown) {
  const t = Date.now();
  const r = await fetch(`${URL}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = r.ok ? await r.json() : { source: `HTTP ${r.status}` };
  console.log(`  ${path} ${JSON.stringify(body)} -> ${j.source ?? "?"} ${j.status ?? ""} (${Date.now() - t} ms)`);
}

async function main() {
  const db = await (await fetch(`${URL}/api/db`)).json();
  console.log(`Warming up against ${URL}: ${db.cases.length} cases, ${db.flags.length} flags`);
  console.log("A2 Root-Cause Analyst (open flags):");
  for (const fl of db.flags.filter((x: { status: string; cause_confirmed: boolean }) => x.status === "open" && !x.cause_confirmed)) await post("/api/agents/analyze-flag", { flag_id: fl.id });
  console.log("A3 Readiness Assessor (cases with scopes):");
  for (const c of db.cases.filter((x: { id: string }) => db.scopes.some((s: { case_id: string }) => s.case_id === x.id))) await post("/api/agents/assess", { case_id: c.id });
  console.log("A8 Report Writer:");
  await post("/api/agents/report", { audience: "management" });
  console.log("Done. Repeat clicks on these now come from the cache.");
}
main().catch((e) => { console.error(e); process.exit(1); });
