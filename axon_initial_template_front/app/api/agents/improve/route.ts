// A9 Process Improver (Extra). POST /api/agents/improve {path_id}. Trigger: a case on the path reaches Closed.
// The benchmark (median days per stage over completed cases) is computed here, never by the model.
// The model reads confirmed root causes on the path and proposes template changes; the PMO approves them in X3.
import { z } from "zod";
import { getDb, json, notFound, save } from "@/lib/server/db";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";
import type { Benchmark, Stage } from "@/lib/types";

export const maxDuration = 60;

const Out = z.object({ suggestions: z.array(z.object({ suggestion: z.string().min(10).max(300), cause_flag_ids: z.array(z.string()) })).max(3) });
const DAY = 86_400_000;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

export async function POST(req: Request) {
  const { path_id } = z.object({ path_id: z.string() }).parse(await req.json());
  const db = await getDb();
  const path = db.paths.find((p) => p.id === path_id);
  if (!path) return notFound("path");
  const cases = db.cases.filter((c) => c.path_id === path_id);
  const completed = cases.filter((c) => c.stage === "closed" || c.outcome);

  // Benchmark in code: days spent in each stage = next stage's entered_at minus this one's, over completed cases.
  const days: Partial<Record<Stage, number[]>> = {};
  for (const c of completed) {
    const h = db.stage_history.filter((x) => x.case_id === c.id).sort((a, b) => a.entered_at.localeCompare(b.entered_at));
    h.slice(0, -1).forEach((x, i) => { (days[x.stage] ??= []).push(Math.round((Date.parse(h[i + 1].entered_at) - Date.parse(x.entered_at)) / DAY)); });
  }
  const benchmarks: Benchmark[] = (Object.entries(days) as [Stage, number[]][]).map(([stage, d]) => ({ path_id, stage, median_days: median(d), n_completed: completed.length, provisional: completed.length < 3 }));

  const causes = db.flags.filter((f) => f.cause_confirmed && cases.some((c) => c.id === f.case_id))
    .map((f) => ({ id: f.id, type: f.type, cause_class: f.cause_class, detail: f.detail, root_cause: f.root_cause }));
  const existing = db.path_suggestions.filter((s) => s.path_id === path_id);
  const r = await callAgent({
    agent: "A9", system: PROMPTS.A9, schema: Out,
    input: { path: { role: path.role_name, project: db.projects.find((p) => p.id === path.project_id)?.name }, confirmed_causes: causes,
      benchmarks: benchmarks.length ? benchmarks : db.benchmarks.filter((b) => b.path_id === path_id), existing_suggestions: existing.map((s) => s.suggestion) },
    fallback: () => ({ suggestions: [] }),
  });
  const causeIds = new Set(causes.map((c) => c.id));
  const known = new Set(existing.map((s) => s.suggestion.trim().toLowerCase()));
  const stamp = Date.now().toString(36);
  const rows = r.output.suggestions.filter((s) => !known.has(s.suggestion.trim().toLowerCase()))
    .map((s, i) => ({ id: `ps-ai-${stamp}-${i}`, path_id, suggestion: s.suggestion, cause_flag_ids: s.cause_flag_ids.filter((id) => causeIds.has(id)), status: "proposed" as const, approved_by: null }));
  if (rows.length || benchmarks.length) await save((d) => {
    if (benchmarks.length) d.benchmarks = [...d.benchmarks.filter((b) => b.path_id !== path_id), ...benchmarks]; // only when there is completion data
    d.path_suggestions.push(...rows);
  }, { actor: r.agent, action: "improve_path", entity: "paths", entity_id: path_id, payload: { suggestions: rows.length, benchmarks: benchmarks.length, status: r.status }, agent: r.agent, model: r.model });
  return json({ source: r.source, status: r.status, proposed: true, path_id, completed: completed.length,
    benchmarks: benchmarks.length ? benchmarks : db.benchmarks.filter((b) => b.path_id === path_id), suggestions: rows.length ? rows : existing });
}
