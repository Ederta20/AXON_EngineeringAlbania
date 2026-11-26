// A9 Process Improver (Extra). POST /api/agents/improve {path_id} -> benchmark (median in SQL) + template suggestions with status proposed
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";

export async function POST(req: Request) {
  const { path_id } = z.object({ path_id: z.string() }).parse(await req.json());
  const db = await getDb();
  return json({ source: "mock", proposed: true, benchmarks: db.benchmarks.filter((b) => b.path_id === path_id), suggestions: db.path_suggestions.filter((s) => s.path_id === path_id) });
}
