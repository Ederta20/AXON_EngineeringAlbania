// A3 Readiness Assessor. POST /api/agents/assess {case_id}
// Writes validations rows with proposed_level only. Never "validated": only the TL sets decided_level.
import { z } from "zod";
import { getDb, json, save } from "@/lib/server/db";
import { callAgent, AgentError } from "@/lib/ai/callAgent";
import { READINESS_SYSTEM } from "@/spec/agents/prompts";
import type { ScopeLevel } from "@/lib/types";

const LEVELS = ["shadowing", "supported", "independent", "ready_with_support", "partially_ready"] as const;
type Proposed = (typeof LEVELS)[number];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    scopes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          scope_id: { type: "STRING" },
          proposed_level: { type: "STRING", enum: [...LEVELS] },
          evidence_ids: { type: "ARRAY", items: { type: "STRING" } },
          confidence: { type: "NUMBER" },
          conflicts: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["scope_id", "proposed_level", "evidence_ids"],
      },
    },
  },
  required: ["scopes"],
};

type Output = { scopes: { scope_id: string; proposed_level: Proposed; evidence_ids: string[]; confidence?: number; conflicts?: string[] }[] };

// validations.proposed_level uses the scope_level enum; map the two readiness labels onto it.
const toScopeLevel = (l: Proposed): ScopeLevel => (l === "ready_with_support" ? "supported" : l === "partially_ready" ? "shadowing" : l);

export async function POST(req: Request) {
  const { case_id } = z.object({ case_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const scopes = db.scopes.filter((s) => s.case_id === case_id).map((s) => ({ id: s.id, name: s.name, is_core: s.is_core, level: s.level }));
  const evidence = db.evidence
    .filter((e) => e.case_id === case_id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((e) => ({ id: e.id, scope_id: e.scope_id, kind: e.kind, author_role: e.author_role, occurred_at: e.occurred_at, summary: e.summary, claimed_status: e.claimed_status, support_level: e.support_level }));
  if (!scopes.length) return json({ error: "case has no scopes" }, 404);

  let out: Output;
  try {
    out = await callAgent<Output>(READINESS_SYSTEM, JSON.stringify({ scopes, evidence }), SCHEMA, { agent: "A3", inputIds: evidence.map((e) => e.id) });
  } catch (e) {
    if (e instanceof AgentError) { console.error(e.message); return json({ status: "needs_review" }, 202); }
    throw e;
  }

  // Drop anything the model made up: unknown scopes or evidence ids.
  const scopeIds = new Set(scopes.map((s) => s.id));
  const evIds = new Set(evidence.map((e) => e.id));
  out.scopes = out.scopes
    .filter((s) => scopeIds.has(s.scope_id) && LEVELS.includes(s.proposed_level))
    .map((s) => ({ ...s, evidence_ids: s.evidence_ids.filter((id) => evIds.has(id)) }));

  const caseRow = db.cases.find((c) => c.id === case_id);
  await save((d) => {
    for (const s of out.scopes) {
      d.validations.push({
        id: `va-ai-${Date.now().toString(36)}-${d.validations.length}`, case_id, scope_id: s.scope_id, tl_id: caseRow?.tl_id ?? null,
        proposed_level: toScopeLevel(s.proposed_level), proposed_by: "ai", evidence_ids: s.evidence_ids,
        confidence: Math.min(1, Math.max(0, s.confidence ?? 0.5)), rationale: (s.conflicts ?? []).join("; ") || "Proposed by A3 from the evidence.",
        decided_level: null, reason: null, decided_at: null, decided_by: null,
      });
    }
  }, { actor: "agent:A3", action: "propose_validations", entity: "case", entity_id: case_id, payload: { count: out.scopes.length } });

  return json(out);
}
