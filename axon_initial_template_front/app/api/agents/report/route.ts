// A8 Report Writer (Extra). POST /api/agents/report {audience} -> text only. Every number is inserted from SQL; the LLM only words it.
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";
import { computeScore } from "@/lib/score";

export async function POST(req: Request) {
  const { audience } = z.object({ audience: z.enum(["management", "digest"]), user_id: z.string().optional() }).parse(await req.json());
  const db = getDb();
  const open = db.flags.filter((f) => f.status === "open");
  const scores = db.cases.map((c) => computeScore(db, c.id).score).filter((x): x is number => x != null);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  return json({ source: "mock", audience, numbers: { open_flags: open.length, high: open.filter((f) => f.severity === "high").length, avg_score: avg },
    text: `This week ${open.length} flags are open, ${open.filter((f) => f.severity === "high").length} of them high severity. The average readiness score is ${avg}.` });
}
