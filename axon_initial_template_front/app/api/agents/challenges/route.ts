// A7 Challenge Generator (Extra). POST /api/agents/challenges {skill_id}
// Reads skill metadata only (no doc content). Writes 2-3 challenges with approved_by empty; the TL approves them in X2.
import { guard } from "@/lib/server/verify";
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";

export const maxDuration = 60;

const Out = z.object({ challenges: z.array(z.object({ prompt: z.string().min(10).max(400) })).min(2).max(3) });

export const POST = guard(async (req: Request) => {
  const { skill_id } = z.object({ skill_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const skill = db.skills.find((s) => s.id === skill_id);
  if (!skill) return notFound("skill");
  const path = db.paths.find((p) => p.id === skill.path_id);
  const existing = db.challenges.filter((c) => c.skill_id === skill_id);
  const r = await callAgent({
    agent: "A7", system: PROMPTS.A7, schema: Out,
    input: { skill: { name: skill.name, doc_ref: skill.doc_ref, coverage: skill.coverage }, role: path?.role_name ?? null,
      project: db.projects.find((p) => p.id === path?.project_id)?.name ?? null, existing_challenges: existing.map((c) => c.prompt) },
    fallback: () => ({ challenges: existing.slice(0, 3).map((c) => ({ prompt: c.prompt })) }),
  });
  const known = new Set(existing.map((c) => c.prompt.trim().toLowerCase()));
  const fresh = r.output.challenges.filter((c) => !known.has(c.prompt.trim().toLowerCase()));
  const stamp = Date.now().toString(36);
  const rows = fresh.map((c, i) => ({ id: `ch-ai-${stamp}-${i}`, skill_id, prompt: c.prompt, approved_by: null, created_by: "ai" as const }));
  if (rows.length) await save((d) => { d.challenges.push(...rows); },
    { actor: r.agent, action: "generate_challenges", entity: "skills", entity_id: skill_id, payload: { count: rows.length, status: r.status }, agent: r.agent, model: r.model });
  return json({ source: r.source, status: r.status, proposed: true, skill_id, challenges: rows.length ? rows : existing.map((c) => ({ ...c, approved_by: null })) });
});
