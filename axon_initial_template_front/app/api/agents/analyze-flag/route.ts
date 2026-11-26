// A2 Root-Cause Analyst (Core). POST /api/agents/analyze-flag {flag_id}
// Writes: flags.cause_class, flags.suggested_owner, flags.detail (one sentence). The PMO confirms on C2.
// TODO(backend): callAgent("A2", ROOT_CAUSE_SYSTEM, {flag, evidence, case, past_flags_on_path}, schema)
import { z } from "zod";
import { getDb, json, notFound } from "@/lib/server/db";
import { A2_CACHE } from "@/lib/rules";

export async function POST(req: Request) {
  const { flag_id } = z.object({ flag_id: z.string() }).parse(await req.json());
  const f = (await getDb()).flags.find((x) => x.id === flag_id);
  if (!f) return notFound("flag");
  const hit = A2_CACHE[flag_id];
  return json({ source: "mock", proposed: true, flag_id, cause_class: hit?.cause ?? null, suggested_owner: hit?.owner ?? null, sentence: hit?.sentence ?? null, status: hit ? "ok" : "needs_review" });
}
