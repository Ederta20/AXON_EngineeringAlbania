// A7 Challenge Generator (Extra). POST /api/agents/challenges {skill_id} -> 2-3 challenges with approved_by empty (TL approves in X2)
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";

export async function POST(req: Request) {
  const { skill_id } = z.object({ skill_id: z.string() }).parse(await req.json());
  return json({ source: "mock", proposed: true, challenges: getDb().challenges.filter((c) => c.skill_id === skill_id).map((c) => ({ ...c, approved_by: null })) });
}
