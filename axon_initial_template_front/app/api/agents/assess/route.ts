// A3 Readiness Assessor (Core). POST /api/agents/assess {case_id}
// Reads: scopes, evidence, past validations, check-ins. Writes: validations with proposed_level only (decided_level stays empty).
// Never "validated": only the TL sets decided_level in C5.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";

const Out = z.object({
  scopes: z.array(z.object({
    scope_id: z.string(),
    proposed_level: z.enum(["shadowing", "supported", "independent"]),
    evidence_ids: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(300),
  })),
  conflicts: z.array(z.string()),
});

export async function POST(req: Request) {
  const { case_id } = z.object({ case_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const c = db.cases.find((x) => x.id === case_id);
  if (!c) return notFound("case");
  const scopes = db.scopes.filter((s) => s.case_id === case_id && s.level !== "validated");
  const input = {
    case: c, scopes,
    evidence: db.evidence.filter((e) => e.case_id === case_id && e.status === "ok"),
    past_validations: db.validations.filter((v) => v.case_id === case_id),
    checkins: db.checkins.filter((x) => x.case_id === case_id),
  };
  const r = await callAgent({
    agent: "A3", system: PROMPTS.A3, input, schema: Out,
    fallback: () => ({
      scopes: db.validations.filter((v) => v.case_id === case_id && !v.decided_level && v.proposed_level !== "validated" && v.proposed_level !== "not_started")
        .map((v) => ({ scope_id: v.scope_id, proposed_level: v.proposed_level as "shadowing" | "supported" | "independent", evidence_ids: v.evidence_ids, confidence: v.confidence, rationale: v.rationale })),
      conflicts: [],
    }),
  });
  const known = new Set(scopes.map((s) => s.id));
  const proposals = r.output.scopes.filter((p) => known.has(p.scope_id)); // ignore scopes the model invented
  await save((d) => {
    for (const p of proposals) {
      const open = d.validations.find((v) => v.scope_id === p.scope_id && !v.decided_level);
      const fields = { proposed_level: p.proposed_level, evidence_ids: p.evidence_ids, confidence: p.confidence, rationale: p.rationale, proposed_by: "ai" as const };
      if (open) Object.assign(open, fields);
      else d.validations.push({ id: `va-${Date.now().toString(36)}-${p.scope_id}`, case_id, scope_id: p.scope_id, tl_id: c.tl_id, ...fields, decided_level: null, reason: null, decided_at: null, decided_by: null });
    }
  }, { actor: r.agent, action: "propose_levels", entity: "cases", entity_id: case_id, payload: { scopes: proposals.length, status: r.status }, agent: r.agent, model: r.model });
  return json({ source: r.source, status: r.status, proposed: true, ...r.output, scopes: proposals });
}
