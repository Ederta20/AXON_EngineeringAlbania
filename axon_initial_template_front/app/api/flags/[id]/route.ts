// PATCH /api/flags/:id {owner_label?, cause_class?, cause_confirmed?, status?, resolution?} -> PMO edits (C2)
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { TODAY } from "@/lib/seed";

const Body = z.object({
  owner_label: z.string().optional(), cause_class: z.enum(["process", "compliance", "external", "individual"]).optional(),
  cause_confirmed: z.boolean().optional(), status: z.enum(["open", "resolved"]).optional(), resolution: z.string().optional(), actor: z.string().default("pmo"),
}).strict();
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { actor, ...b } = Body.parse(await req.json());
  if (!getDb().flags.find((f) => f.id === params.id)) return notFound("flag");
  const d = save((db) => {
    const f = db.flags.find((x) => x.id === params.id)!;
    Object.assign(f, b);
    if (b.status === "resolved") { f.resolved_at = TODAY; db.resolved_flag_ids.push(f.id); }
  }, { actor, action: "update_flag", entity: "flags", entity_id: params.id, payload: b });
  return json(d.flags.find((f) => f.id === params.id));
}
