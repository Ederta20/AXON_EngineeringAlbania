// A3 Readiness Assessor (Core). POST /api/agents/assess {case_id}
// Writes: validations rows with proposed_level only. Never "validated": only the TL sets decided_level.
// TODO(backend): see "Example: A3 Readiness Assessor route" in the backend setup doc.
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";

export async function POST(req: Request) {
  const { case_id } = z.object({ case_id: z.string() }).parse(await req.json());
  const db = await getDb();
  return json({ source: "mock", proposed: true, scopes: db.validations.filter((v) => v.case_id === case_id).map((v) => ({ scope_id: v.scope_id, proposed_level: v.proposed_level, evidence_ids: v.evidence_ids, confidence: v.confidence, conflicts: [] })) });
}
