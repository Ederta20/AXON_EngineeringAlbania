// In-memory stand-in for Postgres so every API route answers with the real contract today.
// Backend: replace getDb()/save() with Supabase/Prisma calls; route handlers keep their shapes.
import type { Db } from "../types";
import { makeSeed } from "../seed";
import { runRules } from "../rules";

const g = globalThis as unknown as { __axonDb?: Db };
export function getDb(): Db {
  if (!g.__axonDb) g.__axonDb = runRules(makeSeed());
  return g.__axonDb;
}
export function save(mutate: (d: Db) => void, audit?: { actor: string; action: string; entity: string; entity_id: string; payload?: Record<string, unknown> }) {
  const d = getDb();
  mutate(d);
  runRules(d);
  if (audit) d.audit_log.unshift({ id: `au-${Date.now().toString(36)}`, at: new Date().toISOString(), ...audit });
  return d;
}
export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const notFound = (what: string) => json({ error: `${what} not found` }, 404);
