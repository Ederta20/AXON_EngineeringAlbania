// A4 Next-Action Drafter (Core). POST /api/agents/draft-action {flag_id}
// Writes: one actions row with status draft (one ask, channel, recipient). Nothing is sent without PMO approval.
// due_at comes from config (escalate rules), never from the model.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { draftAction } from "@/lib/agents";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";
import { TODAY } from "@/lib/seed";

export const maxDuration = 60; // model calls; Vercel cuts routes at 10 s by default

const Out = z.object({
  channel: z.enum(["teams", "outlook"]),
  recipient: z.string(),
  recipient_role: z.string(),
  subject: z.string().nullable(),
  body: z.string().max(800),
});

export async function POST(req: Request) {
  const { flag_id } = z.object({ flag_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const f = db.flags.find((x) => x.id === flag_id);
  if (!f) return notFound("flag");
  const c = db.cases.find((x) => x.id === f.case_id)!;
  const base = draftAction(db, f); // mock draft; also gives due_at and evidence_ids
  const input = {
    flag: f, case: c,
    employee: db.users.find((u) => u.id === c.employee_id)?.name,
    people: db.users.filter((u) => [c.line_manager_id, c.tl_id, f.owner_id].includes(u.id)).map((u) => ({ name: u.name, role: u.role, title: u.title })),
    access_items: db.access_items.filter((a) => a.case_id === c.id),
    due_at: base.due_at,
  };
  const r = await callAgent({
    agent: "A4", system: PROMPTS.A4, input, schema: Out,
    fallback: () => ({ channel: base.channel, recipient: base.recipient, recipient_role: base.recipient_role, subject: base.subject ?? null, body: base.body }),
  });
  const id = `act-${Date.now().toString(36)}`;
  const d = await save((x) => {
    x.actions.push({ id, case_id: f.case_id, flag_id, status: "draft", approved_by: null, created_at: TODAY, thread_ref: `${r.output.channel}://${f.case_id}/thread/${id}`,
      ...r.output, subject: r.output.subject ?? undefined, due_at: base.due_at, evidence_ids: base.evidence_ids });
  }, { actor: r.agent, action: "draft_action", entity: "actions", entity_id: id, payload: { flag_id, status: r.status }, agent: r.agent, model: r.model });
  return json({ ...d.actions.find((a) => a.id === id), source: r.source, agent_status: r.status }, 201); // status = the action's status (draft)
}
