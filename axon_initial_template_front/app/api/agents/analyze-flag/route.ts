// A2 Root-Cause Analyst (Core). POST /api/agents/analyze-flag {flag_id}
// Reads: the flag, its evidence, the case, past flags on the same path. Writes: flags.cause_class, suggested_owner, root_cause
// with cause_confirmed = false. The PMO confirms or changes it on C2. Never overwrites a cause a person confirmed.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { A2_CACHE } from "@/lib/rules";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";

const Out = z.object({
  cause_class: z.enum(["process", "compliance", "external", "individual"]).nullable(),
  suggested_owner: z.string().nullable(),
  sentence: z.string().max(300).nullable(),
});

export async function POST(req: Request) {
  const { flag_id } = z.object({ flag_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const f = db.flags.find((x) => x.id === flag_id);
  if (!f) return notFound("flag");
  const c = db.cases.find((x) => x.id === f.case_id)!;
  const input = {
    flag: f, case: c,
    evidence: db.evidence.filter((e) => f.evidence_ids.includes(e.id)),
    past_flags_on_path: db.flags.filter((x) => x.id !== f.id && db.cases.find((k) => k.id === x.case_id)?.path_id === c.path_id && x.cause_confirmed),
    users: db.users.filter((u) => [c.line_manager_id, c.tl_id].includes(u.id)).map((u) => ({ id: u.id, name: u.name, role: u.role })),
  };
  const r = await callAgent({
    agent: "A2", system: PROMPTS.A2, input, schema: Out,
    fallback: () => { const h = A2_CACHE[flag_id]; return { cause_class: h?.cause ?? null, suggested_owner: h?.owner ?? null, sentence: h?.sentence ?? null }; },
  });
  const status = r.output.cause_class ? r.status : "needs_review";
  if (r.output.cause_class && !f.cause_confirmed) {
    await save((d) => {
      const x = d.flags.find((y) => y.id === flag_id)!;
      x.cause_class = r.output.cause_class; x.suggested_owner = r.output.suggested_owner; x.root_cause = r.output.sentence; x.cause_confirmed = false;
    }, { actor: r.agent, action: "analyze_flag", entity: "flags", entity_id: flag_id, payload: r.output, agent: r.agent, model: r.model });
  }
  return json({ source: r.source, status, proposed: true, flag_id, ...r.output });
}
