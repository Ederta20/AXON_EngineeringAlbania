// POST /api/ingest/replies {thread_ref, summary, received_at} -> A5 Reply Listener: the action becomes answered,
// A1 turns the reply into evidence, the rules rerun and the flag closes. Connector-signed.
import { z } from "zod";
import { json } from "@/lib/server/db";
import { guard, verifyConnector } from "@/lib/server/verify";
import { handleReply } from "@/lib/server/reply";

export const maxDuration = 60; // A1 and the pipeline call the model

const Reply = z.object({ thread_ref: z.string(), summary: z.string().max(500), received_at: z.string() }).strict();
export const POST = guard(async (req) => {
  const { connector, body } = await verifyConnector(req);
  const r = Reply.parse(body);
  const out = await handleReply({ thread_ref: r.thread_ref, text: r.summary, received_at: r.received_at, actor: `connector:${connector}` });
  return json({ ok: true, ...out }, out.matched ? 200 : 202);
});
