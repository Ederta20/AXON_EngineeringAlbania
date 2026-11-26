// GET /api/outbox -> approved actions waiting for the Outbound Sender connector (connector reads from AXON)
import { getDb, json } from "@/lib/server/db";
import { guard, verifyConnector } from "@/lib/server/verify";

export const dynamic = "force-dynamic";
export const GET = guard(async (req) => {
  await verifyConnector(req);
  return json(getDb().actions.filter((a) => a.status === "approved").map(({ id, channel, recipient, subject, body, due_at, thread_ref }) => ({ id, channel, recipient, subject, body, due_at, thread_ref })));
});
