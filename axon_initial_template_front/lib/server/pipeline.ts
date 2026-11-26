// The brief's "what runs when" pipeline (Part 5), after new evidence is saved:
//   the rules engine has already rerun inside save()  ->  A2 explains each new flag  ->  A3 reassesses the case
//   when the new evidence is a task, TL review, 1:1 or check-in.
// Agents still only propose; people confirm. Capped so one request stays inside the route time limit.
import type { Db } from "@/lib/types";
import { POST as analyzeFlag } from "@/app/api/agents/analyze-flag/route";
import { POST as assess } from "@/app/api/agents/assess/route";

const MAX_FLAGS = 3;
/** Routes may run 60 s (maxDuration). Follow-up agents only get the time that is left; they are proposals, so skipping is safe. */
const ROUTE_LIMIT_MS = 55_000;
const MIN_LEFT_MS = 15_000;

/** Resolves with `fallback` when the route is about to run out of time. */
export function withinRoute<T>(p: Promise<T>, startedAt: number, fallback: T): Promise<T> {
  const left = ROUTE_LIMIT_MS - (Date.now() - startedAt);
  if (left < MIN_LEFT_MS) return Promise.resolve(fallback);
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), left))]);
}
const MAX_CASES = 2;
/** Evidence kinds that change readiness (brief, A3 trigger). */
export const READINESS_KINDS = new Set(["task", "tl_review", "checkin", "one_on_one"]);

const call = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request("http://axon.internal/pipeline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
    .then(async (r) => (r.ok ? r.json() : { status: "error", error: `${r.status}` }))
    .catch((e) => ({ status: "error", error: String(e) }));

/** Open flag ids, to diff before and after a save. */
export const openFlagIds = (db: Db) => new Set(db.flags.filter((f) => f.status === "open").map((f) => f.id));

export interface PipelineResult { skipped?: "no time left"; flags_explained: { flag_id: string; cause_class: string | null; source: string }[]; cases_assessed: { case_id: string; scopes: number; source: string }[] }

export async function afterEvidence(opts: { before: Set<string>; after: Db; caseIds: string[]; assessCaseIds: string[]; startedAt: number }): Promise<PipelineResult> {
  return withinRoute(run(opts), opts.startedAt, { skipped: "no time left", flags_explained: [], cases_assessed: [] });
}

async function run(opts: { before: Set<string>; after: Db; caseIds: string[]; assessCaseIds: string[] }): Promise<PipelineResult> {
  const cases = new Set(opts.caseIds);
  const newFlags = opts.after.flags.filter((f) => f.status === "open" && !opts.before.has(f.id) && cases.has(f.case_id) && !f.cause_confirmed).slice(0, MAX_FLAGS);
  const toAssess = Array.from(new Set(opts.assessCaseIds)).slice(0, MAX_CASES);
  // A2 and A3 write different tables, so they can run side by side.
  const [a2, a3] = await Promise.all([
    Promise.all(newFlags.map((f) => call(analyzeFlag, { flag_id: f.id }))),
    Promise.all(toAssess.map((id) => call(assess, { case_id: id }))),
  ]);
  return {
    flags_explained: newFlags.map((f, i) => ({ flag_id: f.id, cause_class: a2[i]?.cause_class ?? null, source: a2[i]?.source ?? "error" })),
    cases_assessed: toAssess.map((id, i) => ({ case_id: id, scopes: a3[i]?.scopes?.length ?? 0, source: a3[i]?.source ?? "error" })),
  };
}
