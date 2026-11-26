// POST /api/requirements/:id/submit -> Core Manager confirms a parsed card; it waits for Admin approval (X7 -> X6)
import { z } from "zod";
import { json, save } from "@/lib/server/db";
import { TODAY } from "@/lib/seed";

const Card = z.object({
  client_id: z.string().nullable(), project_id: z.string(), path_id: z.string().nullable(), type: z.enum(["skill", "access", "deadline", "compliance", "scope"]),
  detail: z.string().max(300), effective_date: z.string().nullable(), affected_case_ids: z.array(z.string()), impact: z.string(), submitted_by: z.string(),
});
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const b = Card.parse(await req.json());
  const d = save((db) => { db.client_requirements.unshift({ ...b, id: params.id, status: "submitted", approved_by: null, reason: null, created_at: TODAY }); },
    { actor: b.submitted_by, action: "submit_requirement", entity: "client_requirements", entity_id: params.id });
  return json(d.client_requirements.find((r) => r.id === params.id), 201);
}
