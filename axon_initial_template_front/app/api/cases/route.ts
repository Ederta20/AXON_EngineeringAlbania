// GET /api/cases -> every case with its score summary and open flag count (feeds L1, L3, X5)
import { getDb, json } from "@/lib/server/db";
import { computeScore } from "@/lib/score";

export const dynamic = "force-dynamic";
export async function GET() {
  const db = await getDb();
  return json(db.cases.map((c) => {
    const s = computeScore(db, c.id);
    return { ...c, score: s.score, band: s.band, completeness: s.completeness, capped: s.capped, provisional: s.provisional,
      open_flags: db.flags.filter((f) => f.case_id === c.id && f.status === "open").length };
  }));
}
