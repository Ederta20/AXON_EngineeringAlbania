import type { Case, Db, Flag, Stage, User } from "./types";
import { TODAY } from "./seed";
import { daysAgo } from "./dates";
import { computeScore } from "./score";
import { FLAG_ORDER } from "./rules";

export const userName = (db: Db, id: string | null | undefined) => db.users.find((u) => u.id === id)?.name ?? null;
export const employee = (db: Db, c: Case) => db.users.find((u) => u.id === c.employee_id)!;
export const project = (db: Db, id: string | null) => db.projects.find((p) => p.id === id) ?? null;
export const openFlags = (db: Db, caseId?: string) =>
  db.flags.filter((f) => f.status === "open" && (!caseId || f.case_id === caseId))
    .sort((a, b) => sevRank(a) - sevRank(b) || FLAG_ORDER.indexOf(a.type) - FLAG_ORDER.indexOf(b.type));
const sevRank = (f: Flag) => ({ high: 0, medium: 1, low: 2 })[f.severity];

export function casesFor(db: Db, user: User | null): Case[] {
  if (!user) return [];
  switch (user.role) {
    case "tl": return db.cases.filter((c) => c.tl_id === user.id);
    case "lm": return db.cases.filter((c) => c.line_manager_id === user.id);
    case "employee": return db.cases.filter((c) => c.id === user.case_id);
    default: return db.cases;
  }
}

// Benchmark: cumulative days from start date to the end of each stage, from the path benchmark.
export function benchmarkStatus(db: Db, c: Case) {
  const order: Stage[] = ["pre_onboarding", "setup", "in_kt", "awaiting_validation"];
  const bm = db.benchmarks.filter((b) => b.path_id === (c.path_id ?? "pa-orion"));
  const idx = order.indexOf(c.stage);
  if (idx < 0) return { delta: 0, label: "Outcome set", provisional: false };
  // pre-onboarding should end on the start date
  const endOfStage = idx === 0 ? 0 : order.slice(1, idx + 1).reduce((a, s) => a + (bm.find((b) => b.stage === s)?.median_days ?? 5), 0);
  const d = daysAgo(c.start_date);
  const delta = endOfStage - d; // positive = days left within benchmark
  const provisional = bm.some((b) => b.provisional) || !c.path_id;
  return { delta, provisional, label: delta >= 0 ? `${delta} day${delta === 1 ? "" : "s"} within benchmark` : `${-delta} day${delta === -1 ? "" : "s"} behind benchmark` };
}

export function atRisk(db: Db, c: Case) {
  const s = computeScore(db, c.id);
  const bm = benchmarkStatus(db, c);
  return bm.delta < 0 && (s.score == null || s.score < 65);
}

export interface NextStep { key: string; title: string; detail: string; owner: string; due?: string | null; kind: "access" | "kt" | "checkin" | "doc" | "wait" }

/** Employee next steps, derived from data (no double entry). */
export function nextSteps(db: Db, c: Case): NextStep[] {
  const steps: NextStep[] = [];
  for (const a of db.access_items.filter((x) => x.case_id === c.id && x.state !== "usable")) {
    steps.push(a.state === "approved"
      ? { key: `acc-${a.id}`, title: `Check that ${a.system} works`, detail: "It is approved. Confirm it works or tell us it doesn't.", owner: "You", kind: "access" }
      : { key: `acc-${a.id}`, title: `Wait for ${a.system}`, detail: `Requested ${a.requested_at}. ${a.owner_label} owns it.`, owner: a.owner_label, due: a.next_followup_at, kind: "wait" });
  }
  const scopes = db.scopes.filter((s) => s.case_id === c.id && s.level !== "validated").sort((a, b) => Number(b.is_core) - Number(a.is_core));
  const tl = userName(db, c.tl_id);
  for (const s of scopes.slice(0, 2)) {
    const t = { not_started: "Book a shadowing session", shadowing: "Do a supported run", supported: "Do a run on your own", independent: "Ask for TL validation", validated: "" }[s.level];
    steps.push({ key: `kt-${s.id}-${s.level}`, title: `${t}: ${s.name}`, detail: tl ? `With ${tl}` : "KT owner not assigned yet", owner: tl ?? "PMO", kind: "kt" });
  }
  const lastCheckin = db.checkins.filter((x) => x.case_id === c.id).map((x) => x.at).sort().reverse()[0];
  if (!lastCheckin || daysAgo(lastCheckin) >= 5) steps.push({ key: `ci-${c.id}-${TODAY}`, title: "Send your weekly check-in", detail: "Three questions, about two minutes.", owner: "You", kind: "checkin" });
  const docs = db.doc_references.filter((d) => d.project_id === c.project_id);
  if (docs.length) steps.push({ key: `doc-${c.id}`, title: `Read ${docs[0].title}`, detail: `In ${docs[0].folder_ref} (project folder)`, owner: "You", kind: "doc" });
  return steps;
}

export const caseStatusLine = (db: Db, c: Case) => {
  const f = openFlags(db, c.id);
  return f.length ? `${f.length} open flag${f.length > 1 ? "s" : ""}` : "On track: no open flags";
};
