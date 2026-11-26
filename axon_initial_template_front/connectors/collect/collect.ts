// Path collector: give it a folder (or file) and it gathers every document in it — exported emails (.eml, .mbox),
// a git repo's docs and commit history, notes and data files — and sends each one to A1 (/api/agents/extract).
// A1 matches the document to a case and saves structured evidence. AXON never stores the raw text, only A1's summaries.
//
// Run:  npx tsx connectors/collect/collect.ts <path> [--case ONB-002] [--dry-run] [--limit 20]
// Config: connectors/.env (AXON_URL, CONNECTOR_ID, CONNECTOR_SECRET), same as the mock connector.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "fs";
import { join, extname, relative, resolve, basename } from "path";
import { execFileSync } from "child_process";

// ───────────── config ─────────────
const env: Record<string, string> = {};
const envFile = join(__dirname, "..", ".env");
if (existsSync(envFile)) for (const l of readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
const AXON_URL = process.env.AXON_URL || env.AXON_URL || "http://localhost:3000";
const SECRET = process.env.CONNECTOR_SECRET || env.CONNECTOR_SECRET || "";
const CONNECTOR_ID = env.CONNECTOR_ID || "path-collector";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const root = args.find((a, i) => !a.startsWith("--") && !["--case", "--limit"].includes(args[i - 1] ?? ""));
const caseHint = flag("--case");
const dryRun = args.includes("--dry-run");
const limit = Number(flag("--limit") ?? Infinity);
if (!root || !existsSync(root)) {
  console.error("Usage: npx tsx connectors/collect/collect.ts <path> [--case ONB-002] [--dry-run] [--limit 20]");
  process.exit(1);
}

// ───────────── what counts as a document ─────────────
type Kind = "email" | "tracker" | "checkin" | "one_on_one" | "pasted";
interface Doc { ref: string; kind: Kind; date: string; text: string }

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "__pycache__", "coverage"]);
const TEXT_EXT = new Set([".txt", ".md", ".json", ".csv", ".log", ".html", ".htm", ".xml", ".yaml", ".yml"]);
const MAX_BYTES = 1_000_000;
const MAX_TEXT = 3800; // A1 accepts 4000 characters

const day = (d: Date) => (isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
const clean = (s: string) => s.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** One RFC 822 message -> a Doc. Keeps From/To/Date/Subject and the plain-text body (base64 / quoted-printable decoded). */
function parseEmail(raw: string, ref: string, fallbackDate: string): Doc {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const headers: Record<string, string> = {};
  head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/).forEach((l) => { const m = l.match(/^([\w-]+):\s*(.*)$/); if (m) headers[m[1].toLowerCase()] = m[2]; });
  let body = rest.join("\n\n");
  const boundary = headers["content-type"]?.match(/boundary="?([^";]+)"?/)?.[1];
  if (boundary) { // multipart: prefer text/plain, else text/html
    const parts = body.split(`--${boundary}`).map((p) => { const [h, ...b] = p.split(/\r?\n\r?\n/); return { h: h.toLowerCase(), b: b.join("\n\n") }; });
    const part = parts.find((p) => p.h.includes("text/plain")) ?? parts.find((p) => p.h.includes("text/html"));
    if (part) body = decode(part.b, part.h);
  } else body = decode(body, (headers["content-transfer-encoding"] ?? "").toLowerCase());
  const date = headers.date ? day(new Date(headers.date)) : fallbackDate;
  const text = [`From: ${headers.from ?? "?"}`, `To: ${headers.to ?? "?"}`, `Date: ${headers.date ?? date}`, `Subject: ${headers.subject ?? ""}`, "", clean(body)].join("\n");
  return { ref: headers["message-id"] ? `${ref}#${headers["message-id"].replace(/[<>]/g, "")}` : ref, kind: "email", date, text };
}
function decode(body: string, enc: string): string {
  if (enc.includes("base64")) try { return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { return body; }
  if (enc.includes("quoted-printable")) return body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return body;
}

/** A git repo's commit history, split into chunks A1 can read (author, date, message per commit). */
function gitHistory(dir: string): Doc[] {
  let log = "";
  try { log = execFileSync("git", ["-C", dir, "log", "--no-merges", "-n", "200", "--date=short", "--pretty=format:%ad | %an | %s"], { encoding: "utf8" }); }
  catch { return []; }
  const lines = log.split("\n").filter(Boolean);
  const docs: Doc[] = [];
  for (let i = 0; i < lines.length; i += 40) {
    const chunk = lines.slice(i, i + 40);
    docs.push({ ref: `repo://${basename(resolve(dir))}/git-log#${i / 40 + 1}`, kind: "tracker", date: chunk[0].slice(0, 10),
      text: `Commit history of repository ${basename(resolve(dir))} (date | author | message):\n${chunk.join("\n")}` });
  }
  return docs;
}

const skipped: { ref: string; why: string }[] = [];
// Inside a git repo, code and data files are not documents: read only its Markdown docs, plus the commit history.
function collect(path: string, base: string, out: Doc[], inRepo = false) {
  const st = statSync(path);
  if (st.isDirectory()) {
    const isRepo = existsSync(join(path, ".git"));
    if (isRepo) out.push(...gitHistory(path));
    for (const name of readdirSync(path).sort()) {
      if (SKIP_DIRS.has(name) || name.startsWith(".env")) continue;
      collect(join(path, name), base, out, inRepo || isRepo);
    }
    return;
  }
  const ext = extname(path).toLowerCase();
  if (inRepo && ext !== ".md") return;
  const ref = `file://${relative(base, path) || basename(path)}`;
  const fileDate = day(st.mtime);
  if (st.size > MAX_BYTES) return void skipped.push({ ref, why: "larger than 1 MB" });
  if (ext === ".eml") return void out.push(parseEmail(readFileSync(path, "utf8"), ref, fileDate));
  if (ext === ".mbox") {
    const msgs = readFileSync(path, "utf8").split(/^From .*$/m).map((m) => m.trim()).filter(Boolean);
    msgs.forEach((m, i) => out.push(parseEmail(m, `${ref}#${i + 1}`, fileDate)));
    return;
  }
  if (TEXT_EXT.has(ext)) {
    const raw = readFileSync(path, "utf8");
    const text = ext === ".html" || ext === ".htm" ? clean(raw) : raw.trim();
    if (text.length < 20) return void skipped.push({ ref, why: "empty" });
    const kind: Kind = /check-?in/i.test(path) ? "checkin" : /1[-_ ]?on[-_ ]?1|one[-_]on[-_]one/i.test(path) ? "one_on_one" : /tracker|status/i.test(path) ? "tracker" : "pasted";
    return void out.push({ ref, kind, date: fileDate, text: `File: ${relative(base, path)}\n\n${text}` });
  }
  if ([".pdf", ".docx", ".xlsx", ".pptx"].includes(ext)) return void skipped.push({ ref, why: `${ext} not supported yet (export it as text)` });
}

// ───────────── send to A1 ─────────────
interface Result { ref: string; kind: Kind; status: string; case_id: string | null; confidence?: number; facts: number; access: number; summaries: string[]; error?: string }

async function extract(d: Doc): Promise<Result> {
  const r = await fetch(`${AXON_URL}/api/agents/extract`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-axon-secret": SECRET, "x-axon-connector": CONNECTOR_ID },
    body: JSON.stringify({ source_kind: d.kind, source_ref: d.ref, text: d.text.slice(0, MAX_TEXT), received_at: d.date, ...(caseHint ? { case_hint: caseHint } : {}) }),
  });
  if (!r.ok) return { ref: d.ref, kind: d.kind, status: "error", case_id: null, facts: 0, access: 0, summaries: [], error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  const o = await r.json();
  return { ref: d.ref, kind: d.kind, status: `${o.status}${o.source === "mock" ? " (mock)" : ""}`, case_id: o.case_id, confidence: o.confidence,
    facts: o.facts?.length ?? 0, access: o.access_updates?.length ?? 0, summaries: (o.facts ?? []).map((f: { summary: string }) => f.summary) };
}

async function main() {
  const base = statSync(root!).isDirectory() ? resolve(root!) : resolve(root!, "..");
  const docs: Doc[] = [];
  collect(resolve(root!), base, docs);
  const todo = docs.slice(0, limit);
  console.log(`Found ${docs.length} document(s) in ${root}${skipped.length ? `, skipped ${skipped.length}` : ""}.${todo.length < docs.length ? ` Sending the first ${todo.length}.` : ""}`);
  if (dryRun) {
    for (const d of todo) console.log(`  ${d.kind.padEnd(10)} ${d.date}  ${d.ref}  (${d.text.length} chars)`);
    for (const s of skipped) console.log(`  skipped    ${s.ref}: ${s.why}`);
    return;
  }
  const results: Result[] = [];
  for (const [i, d] of todo.entries()) { // one at a time: the free Gemini quota is small
    const res = await extract(d).catch((e) => ({ ref: d.ref, kind: d.kind, status: "error", case_id: null, facts: 0, access: 0, summaries: [], error: String(e) } as Result));
    results.push(res);
    console.log(`[${i + 1}/${todo.length}] ${res.ref}\n        -> ${res.case_id ?? "no case"} · ${res.status} · ${res.facts} fact(s)${res.access ? ` · ${res.access} access update(s)` : ""}${res.error ? ` · ${res.error}` : ""}`);
    for (const s of res.summaries) console.log(`           • ${s}`);
  }
  const byCase = results.reduce<Record<string, number>>((m, r) => { const k = r.case_id ?? "unmatched"; m[k] = (m[k] ?? 0) + r.facts; return m; }, {});
  console.log("\nSummary (facts saved per case):", byCase);
  const review = results.filter((r) => !r.status.startsWith("ok"));
  if (review.length) console.log(`${review.length} document(s) need review by the PMO (no case match, low confidence or error).`);
  const report = join(process.cwd(), `collect-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  writeFileSync(report, JSON.stringify({ root, at: new Date().toISOString(), results, skipped }, null, 2)); // summaries and refs only, no raw text
  console.log(`Report: ${report}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
