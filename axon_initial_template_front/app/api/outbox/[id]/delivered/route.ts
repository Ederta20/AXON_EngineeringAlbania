// POST /api/outbox/:id/delivered -> connector confirms delivery; the action becomes sent
import { getDb, json, notFound, save } from "@/lib/server/db";
import { guard, verifyConnector } from "@/lib/server/verify";
import { TODAY } from "@/lib/seed";

export const POST = guard(async (req, { params }: { params: { id: string } }) => {
  const { connector } = await verifyConnector(req);
  if (!(await getDb()).actions.find((a) => a.id === params.id)) return notFound("action");
  await save((db) => { const a = db.actions.find((x) => x.id === params.id)!; a.status = "sent"; a.sent_at = TODAY; },
    { actor: `connector:${connector}`, action: "delivered", entity: "actions", entity_id: params.id });
  return json({ ok: true });
});
