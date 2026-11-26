// PATCH /api/actions/:id -> edit a draft, approve it (goes to the outbox) or reject it with a reason (C4)
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";

const Body = z.object({
  status: z.enum(["approved", "rejected"]).optional(), approved_by: z.string().optional(), reject_reason: z.string().optional(),
  channel: z.enum(["teams", "outlook"]).optional(), recipient: z.string().optional(), subject: z.string().optional(), body: z.string().max(1200).optional(), due_at: z.string().optional(),
}).strict();
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = Body.parse(await req.json());
  const a = getDb().actions.find((x) => x.id === params.id);
  if (!a) return notFound("action");
  if (a.status !== "draft") return json({ error: "only drafts can be changed" }, 409);
  if (b.status === "rejected" && !b.reject_reason) return json({ error: "reject_reason is required" }, 400);
  if (b.status === "approved" && !b.approved_by) return json({ error: "approved_by is required" }, 400);
  save((db) => Object.assign(db.actions.find((x) => x.id === params.id)!, b),
    { actor: b.approved_by ?? "pmo", action: b.status ? `${b.status}_action` : "edit_action", entity: "actions", entity_id: params.id, payload: b });
  return json(getDb().actions.find((x) => x.id === params.id));
}
