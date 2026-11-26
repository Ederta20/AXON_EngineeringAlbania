// A1 Evidence Extractor (Core). POST /api/agents/extract {source_kind, source_ref, text, received_at, case_hint?}
// Writes: evidence rows (extracted_by = ai), proposed access_items states. Low-confidence matches -> status needs_review.
// TODO(backend): replace the mock with callAgent("A1", EXTRACT_SYSTEM, text, schema). Text typed in AXON only; mailbox text stays in /connectors.
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";

const In = z.object({ source_kind: z.enum(["email", "tracker", "checkin", "one_on_one", "pasted"]), source_ref: z.string(), text: z.string().max(4000), received_at: z.string(), case_hint: z.string().optional() });
export async function POST(req: Request) {
  const b = In.parse(await req.json());
  const db = getDb();
  const t = b.text.toLowerCase();
  const c = db.cases.find((x) => x.id === b.case_hint) ?? db.cases.find((x) => t.includes(db.users.find((u) => u.id === x.employee_id)!.name.toLowerCase().split(" ")[0]))
    ?? db.cases.find((x) => t.includes((db.projects.find((p) => p.id === x.project_id)?.code ?? "#").toLowerCase()));
  return json({
    source: "mock", proposed: true,
    case_id: c?.id ?? null, confidence: c ? 0.8 : 0.2, status: c ? "ok" : "needs_review",
    facts: c ? [{ kind: b.source_kind === "pasted" ? "email" : b.source_kind, summary: b.text.slice(0, 200), claimed_status: null, support_level: /alone|independent/.test(t) ? "independent" : /support|help/.test(t) ? "supported" : null, source_ref: b.source_ref, occurred_at: b.received_at }] : [],
  });
}
