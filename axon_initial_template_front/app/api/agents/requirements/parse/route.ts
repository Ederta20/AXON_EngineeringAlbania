// A10 Requirements Assistant (Core-lite). POST /api/agents/requirements/parse {text, project_hint?, user_id}
// Returns requirement cards or one clarifying question. Writes nothing: the manager confirms the cards and submits them
// (POST /api/requirements/:id/submit), then the Admin approves. Only the structured result is stored, never the pasted text.
import { guard } from "@/lib/server/verify";
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";
import { parseRequirement } from "@/lib/agents";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";

export const maxDuration = 60; // model calls; Vercel cuts routes at 10 s by default

const Card = z.object({
  client_id: z.string().nullable(), project_id: z.string(), path_id: z.string().nullable(),
  type: z.enum(["skill", "access", "deadline", "compliance", "scope"]), detail: z.string().max(300),
  effective_date: z.string().nullable(), affected_case_ids: z.array(z.string()), impact: z.string().max(300),
});
const Out = z.object({ cards: z.array(Card), question: z.string().nullable() });

export const POST = guard(async (req: Request) => {
  const b = z.object({ text: z.string().min(5).max(4000), project_hint: z.string().optional(), user_id: z.string().optional() }).parse(await req.json());
  const db = await getDb();
  const text = b.project_hint ? `${b.text} ${b.project_hint}` : b.text;
  const input = {
    text, projects: db.projects, paths: db.paths,
    active_cases: db.cases.filter((c) => c.stage !== "closed").map((c) => ({ id: c.id, project_id: c.project_id, path_id: c.path_id, expected_ready_date: c.expected_ready_date })),
  };
  const r = await callAgent({ agent: "A10", system: PROMPTS.A10, input, schema: Out, fallback: () => parseRequirement(db, text) });
  const ids = new Set(db.cases.map((c) => c.id));
  const cards = r.output.cards.map((c) => ({ ...c, affected_case_ids: c.affected_case_ids.filter((id) => ids.has(id)) }));
  return json({ source: r.source, status: r.status, proposed: true, cards, question: r.output.question });
});
