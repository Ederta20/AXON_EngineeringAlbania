// GET /api/cases/:id -> case detail (C3): scopes, access, evidence references, flags, actions, validations, score breakdown
import { getDb, json, notFound } from "@/lib/server/db";
import { computeScore } from "@/lib/score";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = await getDb();
  const c = db.cases.find((x) => x.id === params.id);
  if (!c) return notFound("case");
  const by = <T extends { case_id: string }>(xs: T[]) => xs.filter((x) => x.case_id === c.id);
  return json({
    case: c, score: computeScore(db, c.id), scopes: by(db.scopes), access_items: by(db.access_items), evidence: by(db.evidence),
    flags: by(db.flags), actions: by(db.actions), validations: by(db.validations), one_on_ones: by(db.one_on_ones), checkins: by(db.checkins),
    doc_references: db.doc_references.filter((d) => d.project_id === c.project_id),
  });
}
