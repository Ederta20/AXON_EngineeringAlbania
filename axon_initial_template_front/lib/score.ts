// Score service. One function, configured by the weight profile.
// score = sum(weight x value) over components with data / sum of those weights.
// Completeness = share of the weight that has data. TL gate caps the score at 84.
import type { Band, Db, ScoreComponent, ScoreResult } from "./types";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const byDateDesc = <T,>(get: (x: T) => string) => (a: T, b: T) => get(b).localeCompare(get(a));

export function bandFor(score: number | null, db?: Db): Band | null {
  if (score == null) return null;
  const b = db?.config.bands ?? { partially_ready: 40, ready_with_support: 65, ready: 85 };
  if (score >= b.ready) return "ready";
  if (score >= b.ready_with_support) return "ready_with_support";
  if (score >= b.partially_ready) return "partially_ready";
  return "not_ready";
}

export function tlGate(db: Db, caseId: string) {
  const core = db.scopes.filter((s) => s.case_id === caseId && s.is_core);
  const validated = core.filter((s) => s.level === "validated");
  return { total: core.length, validated: validated.length, passed: core.length > 0 && validated.length === core.length };
}

export function computeScore(db: Db, caseId: string): ScoreResult {
  const cs = db.cases.find((c) => c.id === caseId)!;
  const p = db.weight_profiles.find((w) => w.id === cs.profile_id) ?? db.weight_profiles[0];
  const ev = db.evidence.filter((e) => e.case_id === caseId && e.status === "ok");

  const tasks = ev.filter((e) => e.kind === "task" && e.value_0_100 != null).sort(byDateDesc((e) => e.occurred_at)).slice(0, 8);
  const tl = ev.filter((e) => e.kind === "tl_review" && e.value_0_100 != null).sort(byDateDesc((e) => e.occurred_at))[0];
  const oo = db.one_on_ones.filter((o) => o.case_id === caseId).sort(byDateDesc((o) => o.held_at)).slice(0, 3);
  const ooAi = oo.filter((o) => o.rating_ai != null);
  const ch = db.challenge_results.filter((r) => r.case_id === caseId && r.score != null);
  const ci = db.checkins.filter((x) => x.case_id === caseId).sort(byDateDesc((x) => x.at)).slice(0, 3);

  const components: ScoreComponent[] = [
    { key: "work", label: "Work evidence", weight: p.w_work, value: avg(tasks.map((t) => t.value_0_100!)), evidence_ids: tasks.map((t) => t.id) },
    { key: "tl", label: "TL review", weight: p.w_tl, value: tl ? tl.value_0_100 : null, evidence_ids: tl ? [tl.id] : [] },
    { key: "oneonone_human", label: "1:1 rating (human)", weight: p.w_1on1_human, value: avg(oo.map((o) => o.rating_human * 10)), evidence_ids: oo.map((o) => o.id) },
    { key: "oneonone_ai", label: "1:1 rating (AI, calibrated)", weight: p.w_1on1_ai, value: avg(ooAi.map((o) => o.rating_ai! * 10)), evidence_ids: ooAi.map((o) => o.id) },
    { key: "challenge", label: "Skill challenges", weight: Math.min(15, p.w_challenge), value: avg(ch.map((r) => r.score!)), evidence_ids: ch.map((r) => r.id) },
    { key: "self", label: "Self-assessment", weight: p.w_self, value: avg(ci.map((x) => x.self_score * 10)), evidence_ids: ci.map((x) => x.id) },
  ];

  const total = components.reduce((a, c) => a + c.weight, 0);
  const withData = components.filter((c) => c.value != null);
  const w = withData.reduce((a, c) => a + c.weight, 0);
  const raw = w ? withData.reduce((a, c) => a + c.weight * (c.value as number), 0) / w : null;
  const gate = tlGate(db, caseId);
  const cap = db.config.tl_cap;
  const capped = raw != null && !gate.passed && raw > cap;
  const score = raw == null ? null : Math.round(capped ? cap : raw);
  const completeness = total ? Math.round((w / total) * 100) : 0;

  return {
    case_id: caseId, score, raw: raw == null ? null : Math.round(raw), band: bandFor(score, db), completeness, capped,
    tl_gate_passed: gate.passed, provisional: completeness < db.config.provisional_below, components, profile_id: p.id,
  };
}

/** Score impact preview for C5: what the score would be if a scope were decided this way. */
export function scoreWith(db: Db, caseId: string, mutate: (d: Db) => void) {
  const copy = structuredClone(db);
  mutate(copy);
  return computeScore(copy, caseId);
}
