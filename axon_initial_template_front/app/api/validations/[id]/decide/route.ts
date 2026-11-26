// POST /api/validations/:id/decide {decided_level, reason?, tl_id} -> TL confirms or overrides (C5). Override needs a reason.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { computeScore } from "@/lib/score";
import { TODAY } from "@/lib/seed";

const Body = z.object({ decided_level: z.enum(["not_started", "shadowing", "supported", "independent", "validated"]), reason: z.string().nullable().optional(), tl_id: z.string() });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const b = Body.parse(await req.json());
  const v = (await getDb()).validations.find((x) => x.id === params.id);
  if (!v) return notFound("validation");
  const confirm = b.decided_level === (v.proposed_level === "independent" ? "validated" : v.proposed_level);
  if (!confirm && (!b.reason || b.reason.trim().length < 5)) return json({ error: "an override needs a reason" }, 400);
  const d = await save((db) => {
    const x = db.validations.find((y) => y.id === params.id)!;
    Object.assign(x, { decided_level: b.decided_level, reason: b.reason ?? null, decided_at: TODAY, decided_by: b.tl_id });
    const s = db.scopes.find((y) => y.id === x.scope_id)!; s.level = b.decided_level; s.level_updated_at = TODAY;
  }, { actor: b.tl_id, action: "validate_scope", entity: "validations", entity_id: params.id, payload: b });
  return json({ validation: d.validations.find((x) => x.id === params.id), score: computeScore(d, v.case_id) });
}
