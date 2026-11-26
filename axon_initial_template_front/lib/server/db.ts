// Data access for the API routes.
// With NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY set, every read and write goes to Supabase.
// Without them it falls back to the in-memory starter-pack seed, so the app still runs offline.
// Route handlers keep the same shapes: `await getDb()` returns the whole Db, `await save(mutate)` applies a change,
// reruns the rules engine and writes back only the rows that changed.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config, Db } from "../types";
import { makeSeed } from "../seed";
import { runRules } from "../rules";
import { TABLES, rowKey, type TableDef } from "./tables";

type Audit = { actor: string; action: string; entity: string; entity_id: string; payload?: Record<string, unknown> };
type Row = Record<string, unknown>;
type DoneStep = { step_key: string; case_id: string; done_at: string };
type Loaded = Db & { _done_rows: DoneStep[] };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
export const usingSupabase = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
function sb() {
  if (!client) client = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// ───────────── in-memory fallback ─────────────
const g = globalThis as unknown as { __axonDb?: Db; __axonCache?: { at: number; db: Loaded } };
function memDb(): Db {
  if (!g.__axonDb) g.__axonDb = runRules(makeSeed());
  return g.__axonDb;
}

// ───────────── Supabase ─────────────
async function selectAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb().from(table).select("*").range(from, from + 999);
    if (table === "audit_log") q = q.order("at", { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(`Supabase read ${table}: ${error.message}`);
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

function toConfig(rows: Row[]): Config {
  const v = Object.fromEntries(rows.map((r) => [r.key as string, r.value]));
  const seed = makeSeed().config;
  return {
    stale_days: Number(v.stale_days ?? seed.stale_days),
    escalate_days: Number(v.escalate_days ?? seed.escalate_days),
    tl_cap: Number(v.tl_cap ?? seed.tl_cap),
    provisional_below: Number(v.provisional_below ?? seed.provisional_below),
    rating_gap: Number(v.rating_gap ?? seed.rating_gap),
    bands: (v.bands as Config["bands"]) ?? seed.bands,
  };
}

/** Rows exactly as stored, before the rules engine runs. */
async function loadRaw(): Promise<Loaded> {
  const [config, ...rest] = await Promise.all([selectAll("config"), ...TABLES.map((t) => selectAll(t.table))]);
  const db = Object.fromEntries(TABLES.map((t, i) => [t.key, rest[i]])) as unknown as Loaded;
  // Postgres numeric comes back as a string in some setups.
  for (const v of db.validations) v.confidence = Number(v.confidence);
  db.config = toConfig(config);
  db.resolved_flag_ids = db.flags.filter((f) => (f as unknown as Row).manually_resolved).map((f) => f.id);
  db._done_rows = db.done_steps as unknown as DoneStep[];
  db.done_steps = db._done_rows.map((r) => r.step_key);
  return db;
}

async function loadSupabase(): Promise<Loaded> {
  return runRules(await loadRaw()) as Loaded; // rules rerun on read so ages and staleness follow the clock
}

/** Which case a C6 step key belongs to: acc-<access id>, kt-<scope id>-<level>, ci-<case>-<date>, doc-<case>. */
function stepCase(db: Db, key: string): string | null {
  if (key.startsWith("acc-")) return db.access_items.find((a) => a.id === key.slice(4))?.case_id ?? null;
  if (key.startsWith("kt-")) return db.scopes.find((s) => key.startsWith(`kt-${s.id}-`))?.case_id ?? null;
  return db.cases.find((c) => key.includes(c.id))?.id ?? null;
}

function rowsFor(def: TableDef, db: Loaded, today: string): Row[] {
  if (def.key === "done_steps") {
    const known = new Map(db._done_rows.map((r) => [r.step_key, r]));
    return db.done_steps.map((k) => known.get(k) ?? { step_key: k, case_id: stepCase(db, k), done_at: today }).filter((r) => r.case_id);
  }
  const rows = db[def.key] as unknown as Row[];
  return rows.map((r) => {
    const out: Row = {};
    for (const c of def.cols) out[c] = r[c] === undefined ? null : r[c];
    if (def.table === "flags") out.manually_resolved = db.resolved_flag_ids.includes(r.id as string);
    if (def.table === "evidence" || def.table === "score_snapshots") out.simulated = Boolean(r.simulated);
    if (def.table === "score_snapshots") {
      out.id ??= `ss-${r.case_id}-${r.computed_at}`;
      out.profile_id ??= db.cases.find((c) => c.id === r.case_id)?.profile_id ?? null;
    }
    if (def.table === "audit_log") out.actor_id = db.users.find((u) => (r.actor as string)?.startsWith(u.name))?.id ?? null;
    return out;
  });
}

async function writeDiff(before: Loaded, after: Loaded) {
  const today = new Date().toISOString().slice(0, 10);
  const plans = TABLES.map((def) => {
    const prev = new Map(rowsFor(def, before, today).map((r) => [rowKey(def, r), JSON.stringify(r)]));
    const next = rowsFor(def, after, today);
    const nextKeys = new Set(next.map((r) => rowKey(def, r)));
    return {
      def,
      upserts: next.filter((r) => prev.get(rowKey(def, r)) !== JSON.stringify(r)),
      deletes: [...prev.keys()].filter((k) => !nextKeys.has(k)),
    };
  });
  for (const { def, upserts } of plans) {
    if (!upserts.length) continue;
    const { error } = await sb().from(def.table).upsert(upserts, { onConflict: def.pk.join(",") });
    if (error) throw new Error(`Supabase write ${def.table}: ${error.message}`);
  }
  for (const { def, deletes } of [...plans].reverse()) {
    for (const k of deletes) {
      const vals = k.split("|");
      let q = sb().from(def.table).delete();
      def.pk.forEach((c, i) => { q = q.eq(c, vals[i]); });
      const { error } = await q;
      if (error) throw new Error(`Supabase delete ${def.table}: ${error.message}`);
    }
  }
}

// ───────────── public API ─────────────
export async function getDb(): Promise<Db> {
  if (!usingSupabase) return memDb();
  const c = g.__axonCache;
  if (c && Date.now() - c.at < 1500) return c.db; // one request often reads several times
  const db = await loadSupabase();
  g.__axonCache = { at: Date.now(), db };
  return db;
}

export async function save(mutate: (d: Db) => void, audit?: Audit): Promise<Db> {
  const entry = audit ? { id: `au-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...audit } : null;
  if (!usingSupabase) {
    const d = memDb();
    mutate(d);
    runRules(d);
    if (entry) d.audit_log.unshift(entry);
    return d;
  }
  g.__axonCache = undefined;
  const before = await loadRaw();
  const after = structuredClone(before);
  runRules(after); // persist anything the rules changed since the last write
  mutate(after);
  runRules(after);
  if (entry) after.audit_log.unshift(entry);
  await writeDiff(before, after);
  g.__axonCache = { at: Date.now(), db: after };
  return after;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const notFound = (what: string) => json({ error: `${what} not found` }, 404);
