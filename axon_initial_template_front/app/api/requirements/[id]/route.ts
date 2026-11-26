// PATCH /api/requirements/:id {approve, reason, admin_id} -> Admin approves or rejects (X6). On approval, rules apply it (no AI).
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";

const Body = z.object({ approve: z.boolean(), reason: z.string().min(3), admin_id: z.string() });
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = Body.parse(await req.json());
  if (!getDb().client_requirements.find((r) => r.id === params.id)) return notFound("requirement");
  const d = save((db) => {
    const r = db.client_requirements.find((x) => x.id === params.id)!;
    r.status = b.approve ? "approved" : "rejected"; r.approved_by = b.admin_id; r.reason = b.reason;
    // TODO(backend): call the same applyRequirement rules used by the demo store (scopes, access_items, expected dates, flags, TL notifications)
  }, { actor: b.admin_id, action: b.approve ? "approve_requirement" : "reject_requirement", entity: "client_requirements", entity_id: params.id, payload: b });
  return json(d.client_requirements.find((r) => r.id === params.id));
}
