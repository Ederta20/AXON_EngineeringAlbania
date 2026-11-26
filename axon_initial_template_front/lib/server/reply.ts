// A5 Reply Listener (brief, Part 5): match the reply to its action, mark it answered, then pass the text to A1,
// which saves it as evidence and runs the pipeline (rules rerun, the flag closes, A2/A3 follow up).
// Used by the connector route (/api/ingest/replies, /api/webhooks/inbound) and the in-app "Simulate reply" (/api/agents/reply).
import { getDb, logAudit, save } from "@/lib/server/db";
import { REPLIES } from "@/lib/agents";
import { POST as extract } from "@/app/api/agents/extract/route";

export interface ReplyIn { thread_ref?: string; action_id?: string; text: string; received_at: string; actor: string }

export async function handleReply(r: ReplyIn) {
  const db = await getDb();
  const a = db.actions.find((x) => (r.action_id && x.id === r.action_id) || (r.thread_ref && (x.thread_ref === r.thread_ref || r.thread_ref.startsWith(x.thread_ref))));
  if (!a) { // brief p.22: unmatched replies go to the PMO (listed under "Needs review" on the flags board)
    await logAudit({ actor: r.actor, action: "reply_unmatched", entity: "replies", entity_id: r.thread_ref ?? r.action_id ?? "unknown",
      payload: { thread_ref: r.thread_ref ?? null, summary: r.text.slice(0, 300), received_at: r.received_at }, agent: "A5 Reply Listener", model: "rules" });
    return { matched: false as const };
  }
  const summary = r.text.slice(0, 500);
  await save((d) => {
    const x = d.actions.find((y) => y.id === a.id)!;
    x.status = "answered"; x.answered_at = r.received_at; x.reply_summary = summary;
    // Demo only: the seeded replies also fill case fields (project, role, owners) that A1 does not write.
    REPLIES[x.flag_id]?.apply(d, d.cases.find((c) => c.id === x.case_id)!);
    const f = d.flags.find((y) => y.id === x.flag_id);
    if (f && f.origin === "manual" && f.status === "open") { f.status = "resolved"; f.resolved_at = r.received_at; f.resolution = `Answered: ${summary}`; }
  }, { actor: r.actor, action: "reply_ingested", entity: "actions", entity_id: a.id, payload: { thread_ref: a.thread_ref }, agent: "A5 Reply Listener", model: "rules" });

  // A1 turns the reply into evidence (the model when configured, its mock otherwise) and runs the pipeline.
  const res = await extract(new Request("http://axon.internal/a5", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ source_kind: "email", source_ref: `${a.thread_ref}#reply`, text: `Reply from ${a.recipient} (${a.recipient_role}) to: "${a.body}"\n\n${r.text}`, received_at: r.received_at, case_hint: a.case_id }),
  }));
  const a1 = res.ok ? await res.json() : { status: "error" };
  return { matched: true as const, action_id: a.id, case_id: a.case_id, evidence_ids: a1.evidence_ids ?? [], a1_source: a1.source, a1_status: a1.status, pipeline: a1.pipeline ?? null };
}
