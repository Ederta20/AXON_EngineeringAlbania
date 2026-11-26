// A10 Requirements Assistant (Core-lite). POST /api/agents/requirements/parse {text, project_hint?, user_id}
// Returns requirement cards or one clarifying question. Only the structured result is stored, never the pasted client email.
// TODO(backend): callAgent("A10", REQUIREMENTS_SYSTEM, {text, projects, paths, active_cases}, schema)
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";
import { parseRequirement } from "@/lib/agents";

export async function POST(req: Request) {
  const b = z.object({ text: z.string().min(5).max(4000), project_hint: z.string().optional(), user_id: z.string().optional() }).parse(await req.json());
  return json({ source: "mock", proposed: true, ...parseRequirement(getDb(), b.project_hint ? `${b.text} ${b.project_hint}` : b.text) });
}
