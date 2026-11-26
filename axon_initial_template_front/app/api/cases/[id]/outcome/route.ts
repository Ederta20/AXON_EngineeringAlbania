// POST /api/cases/:id/outcome {outcome, reason, tl_id} -> TL sets Ready / Ready with Support / Partially Ready.
// Only a TL can call this (enforce with row-level security by role). The UI never sets an outcome on its own.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { TODAY } from "@/lib/seed";
import { afterCompletion, completedCaseIds } from "@/lib/server/completion";

export const maxDuration = 60; // A9 runs on the path when the case completes

const Body = z.object({ outcome: z.enum(["ready", "ready_with_support", "partially_ready"]), reason: z.string().min(5), tl_id: z.string() });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const b = Body.parse(await req.json());
  const before = await getDb();
  if (!before.cases.find((x) => x.id === params.id)) return notFound("case");
  const was = completedCaseIds(before);
  const d = await save((db) => {
    const c = db.cases.find((x) => x.id === params.id)!;
    c.outcome = b.outcome; c.stage = "outcome";
    db.evidence.push({ id: `ev-tl-${Date.now()}`, case_id: c.id, scope_id: null, kind: "tl_review", author_role: "tl", author_label: "Tech Lead", author_id: b.tl_id,
      source_ref: `axon://validation/${c.id}/${TODAY}`, occurred_at: TODAY, summary: b.reason, claimed_status: b.outcome, support_level: null, reworked: false,
      value_0_100: b.outcome === "ready" ? 100 : b.outcome === "ready_with_support" ? 75 : 50, disputed: false, extracted_by: "manual", status: "ok" });
  }, { actor: b.tl_id, action: "set_outcome", entity: "cases", entity_id: params.id, payload: b });
  const a9 = await afterCompletion(was, d, startedAt); // brief pipeline step 6
  return json({ ...d.cases.find((x) => x.id === params.id), a9 });
}
