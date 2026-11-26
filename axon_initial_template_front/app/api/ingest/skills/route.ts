// POST /api/ingest/skills -> Doc agent sends skills per path, coverage and folder references (metadata only, no content)
import { z } from "zod";
import { json, save } from "@/lib/server/db";
import { guard, verifyConnector } from "@/lib/server/verify";
import { TODAY } from "@/lib/seed";

const Skill = z.object({ path_id: z.string(), name: z.string(), folder_ref: z.string().nullable(), coverage: z.number().min(0).max(100) }).strict();
export const POST = guard(async (req) => {
  const { connector, body } = await verifyConnector(req);
  const items = z.array(Skill).max(200).parse(body.items);
  await save((db) => {
    for (const s of items) {
      const doc = s.folder_ref ? db.doc_references.find((d) => d.folder_ref === s.folder_ref) : null;
      const ex = db.skills.find((x) => x.path_id === s.path_id && x.name === s.name);
      if (ex) Object.assign(ex, { coverage: s.coverage, doc_ref: doc?.id ?? ex.doc_ref, last_updated: TODAY });
      else db.skills.push({ id: `sk-${Date.now().toString(36)}-${db.skills.length}`, path_id: s.path_id, name: s.name, doc_ref: doc?.id ?? null, coverage: s.coverage, last_updated: TODAY });
    }
  }, { actor: `connector:${connector}`, action: "ingest_skills", entity: "skills", entity_id: String(items.length) });
  return json({ ok: true });
});
