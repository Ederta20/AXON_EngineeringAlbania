// GET /api/db -> the whole Db for the browser store in "api" mode (NEXT_PUBLIC_DATA_SOURCE=api).
// PUT /api/db {tables, done_add, done_remove, resolved_add, config} -> applies the rows one action changed.
// Demo shortcut: the browser can write any row. Before real users, replace PUT with the per-action routes and check roles.
import { applyChanges, getDb, json, publicDb } from "@/lib/server/db";
import type { DbChanges } from "@/lib/dbdiff";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(publicDb(await getDb()));
}

export async function PUT(req: Request) {
  const changes = (await req.json()) as DbChanges;
  if (!changes || typeof changes.tables !== "object") return json({ error: "invalid changes" }, 400);
  return json(publicDb(await applyChanges(changes)));
}
