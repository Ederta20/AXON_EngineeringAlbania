// POST /api/ingest/replies {thread_ref, summary, received_at} -> the reply closes the loop: action answered, summary becomes evidence, rules rerun
import { z } from "zod";
import { json, save } from "@/lib/server/db";
import { guard, verifyConnector } from "@/lib/server/verify";
import { REPLIES, replyEvidence } from "@/lib/agents";

const Reply = z.object({ thread_ref: z.string(), summary: z.string().max(500), received_at: z.string() }).strict();
export const POST = guard(async (req) => {
  const { connector, body } = await verifyConnector(req);
  const r = Reply.parse(body);
  let matched = false;
  save((db) => {
    const a = db.actions.find((x) => x.thread_ref === r.thread_ref || r.thread_ref.startsWith(x.thread_ref));
    if (!a) return; // unmatched replies go to the PMO
    matched = true;
    a.status = "answered"; a.answered_at = r.received_at; a.reply_summary = r.summary;
    db.evidence.push(replyEvidence(a, r.summary));
    REPLIES[a.flag_id]?.apply(db, db.cases.find((c) => c.id === a.case_id)!); // demo only: the backend runs A1 on the summary instead
  }, { actor: `connector:${connector}`, action: "reply_ingested", entity: "actions", entity_id: r.thread_ref });
  return json({ ok: true, matched }, matched ? 200 : 202);
});
