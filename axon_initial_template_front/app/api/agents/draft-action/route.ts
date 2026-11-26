// A4 Next-Action Drafter (Core). POST /api/agents/draft-action {flag_id}
// Writes: one actions row with status draft (one ask, channel, recipient, due_at). Nothing is sent without PMO approval.
// TODO(backend): callAgent("A4", DRAFT_SYSTEM, {flag, case, owner, access_items, escalate_days}, schema). Dates come from config, not the LLM.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { draftAction } from "@/lib/agents";
import { TODAY } from "@/lib/seed";

export async function POST(req: Request) {
  const { flag_id } = z.object({ flag_id: z.string() }).parse(await req.json());
  const f = (await getDb()).flags.find((x) => x.id === flag_id);
  if (!f) return notFound("flag");
  const d = draftAction((await getDb()), f);
  const id = `act-${Date.now().toString(36)}`;
  await save((db) => { db.actions.push({ id, case_id: f.case_id, flag_id, status: "draft", approved_by: null, created_at: TODAY, thread_ref: `${d.channel}://${f.case_id}/thread/${id}`, ...d }); },
    { actor: "agent:A4", action: "draft_action", entity: "actions", entity_id: id, payload: { flag_id } });
  return json((await getDb()).actions.find((a) => a.id === id), 201);
}
