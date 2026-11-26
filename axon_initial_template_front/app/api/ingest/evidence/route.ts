// POST /api/ingest/evidence -> connectors send structured evidence only. Unknown fields (body, raw, html) are refused.
// Auth: header x-axon-secret must equal CONNECTOR_SECRET.
import { z } from "zod";
import { json, save } from "@/lib/server/db";

const Evidence = z.object({
  case_ref: z.string(),                 // "ONB-005" or a project code like "NIM-482"
  kind: z.enum(["email", "tracker", "tl_review", "task", "checkin"]),
  author_role: z.string(),
  occurred_at: z.string(),
  summary: z.string().max(500),
  claimed_status: z.string().optional(),
  scope: z.string().optional(),
  support_level: z.enum(["shadowing", "supported", "independent"]).optional(),
  source_ref: z.string(),               // a reference, never the content
}).strict();
const Body = z.object({ items: z.array(Evidence).max(50) }).strict();

export async function POST(req: Request) {
  const secret = process.env.CONNECTOR_SECRET;
  if (!secret || req.headers.get("x-axon-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const connector = req.headers.get("x-axon-connector") ?? "unknown";

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const items = parsed.data.items;

  const unmatched: string[] = [];
  await save((db) => {
    for (const e of items) {
      const c = db.cases.find((x) => x.id === e.case_ref) ?? db.cases.find((x) => db.projects.find((p) => p.id === x.project_id)?.code === e.case_ref);
      if (!c) { unmatched.push(e.source_ref); console.warn(`[ingest] no case for ${e.case_ref} (${e.source_ref})`); continue; }
      const scope = e.scope ? db.scopes.find((s) => s.case_id === c.id && s.name.toLowerCase() === e.scope!.toLowerCase()) : null;
      db.evidence.push({ id: `ev-in-${Date.now().toString(36)}-${db.evidence.length}`, case_id: c.id, scope_id: scope?.id ?? null, kind: e.kind,
        author_role: e.author_role as never, author_label: e.author_role, author_id: null, source_ref: e.source_ref, occurred_at: e.occurred_at, summary: e.summary,
        claimed_status: e.claimed_status ?? null, support_level: e.support_level ?? null, reworked: false, value_0_100: e.support_level ? { independent: 100, supported: 60, shadowing: 20 }[e.support_level] : null,
        disputed: false, extracted_by: connector, status: "ok" });
    }
  }, { actor: `connector:${connector}`, action: "ingest", entity: "evidence", entity_id: String(items.length), payload: { count: items.length - unmatched.length } });
  return json({ ok: true, accepted: items.length - unmatched.length, unmatched });
}
