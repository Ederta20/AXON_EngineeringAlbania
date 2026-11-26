// A6 1:1 Scorer (Core-lite). POST /api/agents/score-1on1 {case_id, rater_id, rating_human, note}
// Writes: one_on_ones.rating_ai; raises a rating_gap flag when |AI - human| > config.rating_gap. Counts 5% of the score.
// TODO(backend): callAgent("A6", ONE_ON_ONE_SYSTEM, {note, rater_past}, schema)
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";
import { scoreOneOnOne } from "@/lib/agents";

const In = z.object({ case_id: z.string(), rater_id: z.string(), rating_human: z.number().min(1).max(10), note: z.string().max(2000) });
export async function POST(req: Request) {
  const b = In.parse(await req.json());
  const db = getDb();
  const past = db.one_on_ones.filter((o) => o.rater_id === b.rater_id).map((o) => o.rating_human);
  const ai = scoreOneOnOne(b.note, past);
  return json({ source: "mock", proposed: true, rating_ai: ai, gap: Math.abs(ai - b.rating_human) > db.config.rating_gap });
}
