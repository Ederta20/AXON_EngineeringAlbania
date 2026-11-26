// A1 Evidence Extractor (Core). POST /api/agents/extract {source_kind, source_ref, text, received_at, case_hint?}
// Writes: one evidence row per fact (extracted_by = ai), and proposed access states (access_items.proposed_state).
// Low confidence (< 0.6) or no case match -> status needs_review for the PMO. The raw text is never stored, only the summary.
import { z } from "zod";
import { getDb, json, save } from "@/lib/server/db";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";

const In = z.object({ source_kind: z.enum(["email", "tracker", "checkin", "one_on_one", "pasted"]), source_ref: z.string(), text: z.string().max(4000), received_at: z.string(), case_hint: z.string().optional() });
const Out = z.object({
  case_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  facts: z.array(z.object({
    kind: z.enum(["email", "tracker", "tl_review", "task", "checkin"]),
    scope_name: z.string().nullable(),
    author_role: z.enum(["employee", "hr", "lm", "tl", "pmo", "mgmt", "core_manager", "admin", "access_support", "kt_owner", "tm"]),
    author_label: z.string(),
    occurred_at: z.string(),
    summary: z.string().max(500),
    claimed_status: z.string().nullable(),
    support_level: z.enum(["shadowing", "supported", "independent"]).nullable(),
  })),
  access_updates: z.array(z.object({ system: z.string(), proposed_state: z.enum(["requested", "approved", "usable"]) })),
});

export async function POST(req: Request) {
  const b = In.parse(await req.json());
  const db = await getDb();
  const input = {
    ...b,
    cases: db.cases.map((c) => ({ id: c.id, employee: db.users.find((u) => u.id === c.employee_id)?.name, project_code: db.projects.find((p) => p.id === c.project_id)?.code ?? null,
      scopes: db.scopes.filter((s) => s.case_id === c.id).map((s) => s.name), access: db.access_items.filter((a) => a.case_id === c.id).map((a) => ({ system: a.system, state: a.state })) })),
  };
  const r = await callAgent({
    agent: "A1", system: PROMPTS.A1, input, schema: Out,
    fallback: () => {
      const t = b.text.toLowerCase();
      const c = db.cases.find((x) => x.id === b.case_hint) ?? db.cases.find((x) => t.includes(db.users.find((u) => u.id === x.employee_id)!.name.toLowerCase().split(" ")[0]))
        ?? db.cases.find((x) => t.includes((db.projects.find((p) => p.id === x.project_id)?.code ?? "#").toLowerCase()));
      return {
        case_id: c?.id ?? null, confidence: c ? 0.8 : 0.2,
        facts: c ? [{ kind: (b.source_kind === "pasted" || b.source_kind === "one_on_one" ? "email" : b.source_kind) as "email", scope_name: null, author_role: "pmo" as const, author_label: "Pasted update",
          occurred_at: b.received_at, summary: b.text.slice(0, 200), claimed_status: null,
          support_level: (/alone|independent/.test(t) ? "independent" : /support|help/.test(t) ? "supported" : null) as "independent" | "supported" | null }] : [],
        access_updates: [],
      };
    },
  });
  const o = r.output;
  const c = db.cases.find((x) => x.id === o.case_id);
  const status = !c || o.confidence < 0.6 || r.status === "needs_review" ? "needs_review" : "ok";
  const stamp = Date.now().toString(36);
  const ids = c ? o.facts.map((_, i) => `ev-ai-${stamp}-${i}`) : [];
  if (c) {
    await save((d) => {
      o.facts.forEach((f, i) => {
        const scope = f.scope_name ? d.scopes.find((s) => s.case_id === c.id && s.name.toLowerCase() === f.scope_name!.toLowerCase()) : null;
        const id = ids[i];
        d.evidence.push({ id, case_id: c.id, scope_id: scope?.id ?? null, kind: f.kind, author_role: f.author_role, author_label: f.author_label, author_id: null,
          source_ref: b.source_ref, occurred_at: f.occurred_at, summary: f.summary, claimed_status: f.claimed_status, support_level: f.support_level, reworked: false,
          value_0_100: f.kind === "task" && f.support_level ? { independent: 100, supported: 60, shadowing: 20 }[f.support_level] : null,
          disputed: false, extracted_by: "ai", status });
      });
      for (const u of o.access_updates) {
        const a = d.access_items.find((x) => x.case_id === c.id && x.system.toLowerCase() === u.system.toLowerCase());
        if (a && a.state !== u.proposed_state) a.proposed_state = u.proposed_state; // a person confirms it
      }
    }, { actor: r.agent, action: "extract_evidence", entity: "evidence", entity_id: ids.join(",") || "none", payload: { source_ref: b.source_ref, status }, agent: r.agent, model: r.model });
  }
  return json({ source: r.source, status, proposed: true, evidence_ids: ids, ...o });
}
