// A9 trigger (brief p.24, pipeline step 6): "a case reaches Closed" -> recompute the path benchmark and propose template changes.
// The app sets an Outcome but has no Closed step yet, so a case counts as completed when its outcome is set (or it closes).
import type { Db } from "@/lib/types";
import { POST as improve } from "@/app/api/agents/improve/route";

const completed = (db: Db) => new Set(db.cases.filter((c) => c.outcome || c.stage === "closed").map((c) => c.id));

/** Runs A9 once per path that has a newly completed case. Never throws: A9 is a background proposal. */
export async function afterCompletion(before: Db | Set<string>, after: Db) {
  const was = before instanceof Set ? before : completed(before);
  const paths = new Set(after.cases.filter((c) => c.path_id && (c.outcome || c.stage === "closed") && !was.has(c.id)).map((c) => c.path_id as string));
  const out: { path_id: string; suggestions: number; source: string }[] = [];
  for (const path_id of paths) {
    const r = await improve(new Request("http://axon.internal/a9", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path_id }) }))
      .then((x) => (x.ok ? x.json() : null)).catch(() => null);
    out.push({ path_id, suggestions: r?.suggestions?.filter((s: { status: string }) => s.status === "proposed").length ?? 0, source: r?.source ?? "error" });
  }
  return out;
}
export { completed as completedCaseIds };
