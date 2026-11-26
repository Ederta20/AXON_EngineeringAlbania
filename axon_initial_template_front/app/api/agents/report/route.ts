// A8 Report Writer (Extra). POST /api/agents/report {audience: management | digest, user_id?}
// Every number is computed here (the brief's SQL views); the model only words them. Writes nothing to the data.
// Guardrail: if the text contains a number that is not in the input, it is rejected and the plain template is used.
import { z } from "zod";
import { getDb, json } from "@/lib/server/db";
import { computeScore } from "@/lib/score";
import { atRisk, casesFor, employee, project } from "@/lib/selectors";
import { callAgent } from "@/lib/ai/callAgent";
import { PROMPTS } from "@/lib/ai/prompts";
import { TODAY } from "@/lib/seed";

export const maxDuration = 60;

const Out = z.object({ subject: z.string().max(120), text: z.string().max(2500) });

export async function POST(req: Request) {
  const { audience, user_id } = z.object({ audience: z.enum(["management", "digest"]), user_id: z.string().optional() }).parse(await req.json());
  const db = await getDb();
  const user = user_id ? db.users.find((u) => u.id === user_id) ?? null : null;
  const cases = (audience === "digest" && user ? casesFor(db, user) : db.cases).filter((c) => c.stage !== "closed");
  const ids = new Set(cases.map((c) => c.id));
  const open = db.flags.filter((f) => f.status === "open" && ids.has(f.case_id));
  const scored = cases.map((c) => ({ c, s: computeScore(db, c.id) }));
  const withScore = scored.filter((x) => x.s.score != null);
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
  const done = db.cases.filter((c) => c.outcome && c.expected_ready_date);
  const numbers = {
    as_of: TODAY,
    active_onboardings: cases.length,
    open_flags: open.length,
    high_severity_flags: open.filter((f) => f.severity === "high").length,
    flags_past_deadline: open.filter((f) => f.due_at < TODAY).length,
    flags_by_type: count(open.map((f) => f.type)),
    flags_by_cause: count(open.map((f) => f.cause_class ?? "unclassified")),
    at_risk: cases.filter((c) => atRisk(db, c)).length,
    average_score: withScore.length ? Math.round(withScore.reduce((a, x) => a + (x.s.score as number), 0) / withScore.length) : null,
    pending_validations: db.validations.filter((v) => ids.has(v.case_id) && !v.decided_level).length,
    outcomes_set: done.length,
  };
  const people = scored.map(({ c, s }) => ({ name: employee(db, c).name, case_id: c.id, project: project(db, c.project_id)?.name ?? null, stage: c.stage,
    score: s.score, band: s.band, at_risk: atRisk(db, c), open_flags: open.filter((f) => f.case_id === c.id).map((f) => f.type) }));
  const template = () => ({
    subject: audience === "management" ? `AXON onboarding report, ${TODAY}` : `Your AXON digest, ${TODAY}`,
    text: `${numbers.active_onboardings} active onboardings, ${numbers.open_flags} open flags (${numbers.high_severity_flags} high severity, ${numbers.flags_past_deadline} past deadline). ${numbers.at_risk} at risk. Average readiness score ${numbers.average_score ?? "n/a"}. ${numbers.pending_validations} validations wait for a TL.`,
  });
  const input = { audience, reader: user ? { name: user.name, title: user.title } : null, numbers, people };
  const r = await callAgent({ agent: "A8", system: PROMPTS.A8, input, schema: Out, fallback: template });

  // Every number in the text must appear in the input (dates and case ids included).
  const allowed = new Set((JSON.stringify(input).match(/\d+/g) ?? []));
  const stray = (r.output.text + " " + r.output.subject).match(/\d+/g)?.filter((n) => !allowed.has(n)) ?? [];
  const ok = r.source === "ai" && stray.length === 0;
  const out = ok ? r.output : template();
  return json({ source: ok ? "ai" : "mock", status: stray.length ? "needs_review" : r.status, audience, numbers, ...out, ...(stray.length ? { rejected_numbers: stray } : {}) });
}
