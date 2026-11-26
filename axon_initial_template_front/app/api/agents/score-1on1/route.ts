// A6 1:1 Scorer (Core-lite). POST /api/agents/score-1on1 {case_id, rater_id, rating_human, note}
// Writes: a one_on_ones row with rating_ai, and a rating_gap flag when |AI - human| > config.rating_gap. Counts 5% of the score.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { scoreOneOnOne } from "@/lib/agents";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";
import { TODAY } from "@/lib/seed";
import { addDays } from "@/lib/dates";
import { POST as assess } from "@/app/api/agents/assess/route";

export const maxDuration = 60;

/** Brief: the AI scores on a fixed rubric, then AXON adjusts it to this rater's own scale once they have 3 ratings.
 *  The adjustment is plain arithmetic in code (numbers never come from the model): the rater's average human-minus-AI offset. */
function calibrate(raw: number, past: { human: number; ai: number | null }[]) {
  const pairs = past.filter((p) => p.ai != null);
  if (pairs.length < 3) return { score: raw, offset: 0, calibrated: false };
  const offset = pairs.reduce((s, p) => s + (p.human - (p.ai as number)), 0) / pairs.length;
  return { score: Math.min(10, Math.max(1, Math.round(raw + offset))), offset: Math.round(offset * 10) / 10, calibrated: true };
}

const In = z.object({ case_id: z.string(), rater_id: z.string(), rating_human: z.number().int().min(1).max(10), note: z.string().max(2000) });
const Out = z.object({ rating_ai: z.number().int().min(1).max(10), rationale: z.string().max(300),
  rubric: z.object({ understanding: z.number().int().min(1).max(10), communication: z.number().int().min(1).max(10), confidence: z.number().int().min(1).max(10), issues_raised: z.number().int().min(1).max(10) }).optional() });

export async function POST(req: Request) {
  const b = In.parse(await req.json());
  const db = await getDb();
  if (!db.cases.some((c) => c.id === b.case_id)) return notFound("case");
  const rater_past = db.one_on_ones.filter((o) => o.rater_id === b.rater_id).map((o) => ({ human: o.rating_human, ai: o.rating_ai }));
  const r = await callAgent({
    agent: "A6", system: PROMPTS.A6, input: { note: b.note }, schema: Out, // the rater's history is used for calibration in code, not shown to the model
    fallback: () => ({ rating_ai: Math.min(10, Math.max(1, Math.round(scoreOneOnOne(b.note, rater_past.map((p) => p.human))))), rationale: "Mock score from note keywords." }),
  });
  const cal = calibrate(r.output.rating_ai, rater_past);
  const ai = cal.score;
  const gap = Math.abs(ai - b.rating_human) > db.config.rating_gap;
  const id = `oo-${Date.now().toString(36)}`;
  const rater = db.users.find((u) => u.id === b.rater_id);
  await save((d) => {
    d.one_on_ones.push({ id, case_id: b.case_id, rater_id: b.rater_id, rating_human: b.rating_human, rating_ai: ai, note: b.note, held_at: TODAY });
    if (gap) d.flags.push({ id: `fl-rating_gap-${b.case_id}-${id}`, case_id: b.case_id, type: "rating_gap", severity: "low", cause_class: null, cause_confirmed: false,
      owner_id: b.rater_id, owner_label: rater?.name ?? "Rater", suggested_owner: null, raised_at: TODAY, due_at: addDays(TODAY, 3), status: "open", evidence_ids: [id],
      detail: `1:1 rated ${b.rating_human}/10 by ${rater?.name ?? "the rater"}; AI scored the note ${ai}/10. Gap over ${d.config.rating_gap} points.`, root_cause: null, origin: "manual" });
  }, { actor: r.agent, action: "score_1on1", entity: "one_on_ones", entity_id: id, payload: { rating_human: b.rating_human, rating_ai: ai, gap }, agent: r.agent, model: r.model });
  // A 1:1 is readiness evidence: A3 reassesses the case (brief pipeline).
  const a3 = await assess(new Request("http://axon.internal/a6", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: b.case_id }) }))
    .then((x) => (x.ok ? x.json() : null)).catch(() => null);
  return json({ source: r.source, status: r.status, proposed: true, id, rating_ai: ai, rating_ai_raw: r.output.rating_ai, calibration: cal, rubric: (r.output as z.infer<typeof Out>).rubric ?? null,
    rationale: r.output.rationale, gap, reassessed: a3 ? { source: a3.source, scopes: a3.scopes?.length ?? 0 } : null });
}
