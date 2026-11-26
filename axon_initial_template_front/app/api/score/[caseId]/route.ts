// GET /api/score/:caseId -> score service output (components, completeness, TL gate, cap). Numbers come from code, never the LLM.
import { getDb, json, notFound } from "@/lib/server/db";
import { computeScore } from "@/lib/score";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { caseId: string } }) {
  const db = await getDb();
  if (!db.cases.find((c) => c.id === params.caseId)) return notFound("case");
  return json(computeScore(db, params.caseId));
}
