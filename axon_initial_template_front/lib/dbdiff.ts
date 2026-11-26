// Row-level diff between two Db states. The browser store sends this to PUT /api/db in "api" mode,
// so only the rows an action touched are written to Supabase.
import type { Config, Db } from "./types";
import { TABLES, rowKey } from "./server/tables";

type Row = Record<string, unknown>;

export interface DbChanges {
  tables: Record<string, { upsert: Row[]; delete: string[] }>; // keyed by Db field (cases, flags, ...)
  done_add: string[];
  done_remove: string[];
  resolved_add: string[];
  config: Config | null;
}

export function diffDb(prev: Db, next: Db): DbChanges {
  const tables: DbChanges["tables"] = {};
  for (const def of TABLES) {
    if (def.key === "done_steps") continue;
    const a = new Map((prev[def.key] as unknown as Row[]).map((r) => [rowKey(def, r), JSON.stringify(r)]));
    const nextRows = next[def.key] as unknown as Row[];
    const nextKeys = new Set(nextRows.map((r) => rowKey(def, r)));
    const upsert = nextRows.filter((r) => a.get(rowKey(def, r)) !== JSON.stringify(r));
    const del = [...a.keys()].filter((k) => !nextKeys.has(k));
    if (upsert.length || del.length) tables[def.key] = { upsert, delete: del };
  }
  return {
    tables,
    done_add: next.done_steps.filter((k) => !prev.done_steps.includes(k)),
    done_remove: prev.done_steps.filter((k) => !next.done_steps.includes(k)),
    resolved_add: next.resolved_flag_ids.filter((k) => !prev.resolved_flag_ids.includes(k)),
    config: JSON.stringify(prev.config) === JSON.stringify(next.config) ? null : next.config,
  };
}

export const isEmpty = (c: DbChanges) =>
  !Object.keys(c.tables).length && !c.done_add.length && !c.done_remove.length && !c.resolved_add.length && !c.config;

/** Applies a diff to a Db in place (server side, onto the current database state). */
export function applyDiff(db: Db, c: DbChanges) {
  for (const def of TABLES) {
    const ch = c.tables[def.key];
    if (!ch || def.key === "done_steps") continue;
    const rows = db[def.key] as unknown as Row[];
    const drop = new Set(ch.delete);
    const kept = rows.filter((r) => !drop.has(rowKey(def, r)));
    for (const r of ch.upsert) {
      const i = kept.findIndex((x) => rowKey(def, x) === rowKey(def, r));
      if (i >= 0) kept[i] = r; else if (def.key === "audit_log") kept.unshift(r); else kept.push(r);
    }
    (db as unknown as Record<string, Row[]>)[def.key] = kept;
  }
  db.done_steps = [...db.done_steps.filter((k) => !c.done_remove.includes(k)), ...c.done_add.filter((k) => !db.done_steps.includes(k))];
  for (const k of c.resolved_add) if (!db.resolved_flag_ids.includes(k)) db.resolved_flag_ids.push(k);
  if (c.config) db.config = c.config;
}
