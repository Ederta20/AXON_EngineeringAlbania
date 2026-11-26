// Builds the Supabase mock dataset.
//   1. Starts from the front end's starter-pack seed (lib/seed.ts, ONB-001..ONB-010) so ids and values match the UI.
//   2. Adds ONB-011..ONB-020: fictional cases that cover every state the schema allows but the pack does not
//      (closed, outcome, upskill, rating gap, client requirement, blocked, at risk, answered/rejected/approved/draft actions,
//      needs_review evidence, A1 proposed access state, per-scope check-ins, future start).
//   3. Runs the real rules engine and score service so flags and snapshots are exactly what the app would compute.
//   4. Writes supabase/seed.sql, supabase/data/csv/<table>.csv and supabase/data/axon_seed.json.
// Run: bash supabase/scripts/generate.sh
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { makeSeed, TODAY } from "../../axon_initial_template_front/lib/seed";
import { runRules } from "../../axon_initial_template_front/lib/rules";
import { computeScore, bandFor } from "../../axon_initial_template_front/lib/score";
import { addDays } from "../../axon_initial_template_front/lib/dates";
import type {
  AccessItem, Case, ClientRequirement, Db, Evidence, Flag, Scope, Stage, User, Validation,
} from "../../axon_initial_template_front/lib/types";

const OUT = process.argv[2] ?? join(__dirname, "..");
const db: Db = makeSeed();

// ───────────────────────── helpers ─────────────────────────
const user = (id: string, name: string, title: string, case_id: string): User =>
  ({ id, name, email: `${name.toLowerCase().replace(/ /g, ".")}@example.test`, role: "employee", title, case_id });
const kase = (x: Partial<Case> & Pick<Case, "id" | "employee_id" | "movement_type" | "start_date" | "stage" | "tracker_status" | "tracker_updated_at" | "profile_id">): Case =>
  ({ project_id: null, role: null, path_id: null, line_manager_id: null, tl_id: null, expected_ready_date: null, outcome: null, seniority: "mid", ...x });
const scope = (id: string, case_id: string, name: string, level: Scope["level"], at: string, is_core = true, added_by_requirement: string | null = null): Scope =>
  ({ id, case_id, name, is_core, level, level_updated_at: at, added_by_requirement });
const acc = (x: Partial<AccessItem> & Pick<AccessItem, "id" | "case_id" | "system" | "state" | "requested_at">): AccessItem =>
  ({ owner_label: "Access Support", updated_at: x.requested_at, next_followup_at: null, note: null, proposed_state: null, ...x });
const ev = (x: Partial<Evidence> & Pick<Evidence, "id" | "case_id" | "kind" | "author_label" | "occurred_at" | "summary" | "source_ref">): Evidence => ({
  scope_id: null, author_role: "pmo", author_id: null, claimed_status: null, support_level: null, reworked: false,
  value_0_100: null, disputed: false, extracted_by: "ai", status: "ok", simulated: true, ...x,
});
const LV = { independent: 100, supported: 60, shadowing: 20 } as const;
const task = (id: string, case_id: string, scope_id: string, occurred_at: string, lvl: keyof typeof LV, summary: string, author_label: string, author_id: string, reworked = false): Evidence =>
  ev({ id, case_id, scope_id, kind: "task", author_role: "tl", author_label, author_id, occurred_at, summary, support_level: lvl,
    value_0_100: Math.max(0, LV[lvl] - (reworked ? 20 : 0)), reworked, source_ref: `tasklog://${case_id}/${id}`, extracted_by: "manual" });
const val = (id: string, case_id: string, scope_id: string, tl_id: string, proposed: Validation["proposed_level"], confidence: number, rationale: string,
  evidence_ids: string[], decided?: { level: Validation["proposed_level"]; at: string; reason?: string }): Validation =>
  ({ id, case_id, scope_id, tl_id, proposed_level: proposed, proposed_by: "ai", evidence_ids, confidence, rationale,
    decided_level: decided?.level ?? null, reason: decided?.reason ?? null, decided_at: decided?.at ?? null, decided_by: decided ? tl_id : null });
const hist = (case_id: string, items: [Stage, string][]) => items.map(([stage, entered_at]) => ({ case_id, stage, entered_at }));

// ───────────────────────── reference additions ─────────────────────────
db.doc_references.push(
  { id: "doc-aurora-1", project_id: "p-aurora", path_id: "pa-aurora", title: "Aurora ticket handling guide", folder_ref: "/Aurora/Support/KT", owner_label: "Kai Brennan", verified_at: "2026-10-02" },
  { id: "doc-pulse-1", project_id: "p-pulse", path_id: "pa-pulse", title: "Pulse pipeline runbook", folder_ref: "/Pulse/Data/Runbooks", owner_label: "Ivo Sand", verified_at: null },
  { id: "doc-nova-1", project_id: "p-nova", path_id: "pa-nova", title: "Nova NOC monitoring handbook", folder_ref: "/Nova/Network/NOC", owner_label: "Cleo Marsh", verified_at: "2026-09-12" },
);
db.skills.push(
  { id: "sk-aurora-1", path_id: "pa-aurora", name: "Ticket handling", doc_ref: "doc-aurora-1", coverage: 80, last_updated: "2026-10-02" },
  { id: "sk-aurora-2", path_id: "pa-aurora", name: "Knowledge base upkeep", doc_ref: null, coverage: 10, last_updated: "2026-10-02" },
  { id: "sk-pulse-1", path_id: "pa-pulse", name: "Pipeline operations", doc_ref: "doc-pulse-1", coverage: 55, last_updated: "2026-09-25" },
  { id: "sk-nova-1", path_id: "pa-nova", name: "Network monitoring", doc_ref: "doc-nova-1", coverage: 70, last_updated: "2026-09-12" },
);
db.challenges.push(
  { id: "ch-vega-2", skill_id: "sk-vega-1", prompt: "The morning batch check shows 3 failed jobs, one on a client-facing service. Which do you handle first and what do you record?", approved_by: "u-tl-vega", created_by: "ai" },
  { id: "ch-aurora-1", skill_id: "sk-aurora-1", prompt: "A ticket has been reopened twice by the same user. How do you find the root cause before replying?", approved_by: "u-tl-aurora", created_by: "ai" },
  { id: "ch-pulse-1", skill_id: "sk-pulse-1", prompt: "The nightly load finished but row counts are 40% lower than usual. What do you check before restarting it?", approved_by: null, created_by: "ai" },
);

// ───────────────────────── client requirements (X7 / A10) ─────────────────────────
const reqs: ClientRequirement[] = [
  { id: "req-001", client_id: "c-meridian", project_id: "p-orion", path_id: "pa-orion", type: "skill", detail: "Complete PCI-DSS awareness training",
    effective_date: "2026-11-06", affected_case_ids: ["ONB-015"], impact: "1 case gets a new PCI-DSS awareness scope; 1 expected date moves earlier to 6 Nov.",
    status: "approved", submitted_by: "u-cm", approved_by: "u-admin", reason: "Contractual for Meridian from November.", created_at: "2026-10-09" },
  { id: "req-002", client_id: "c-meridian", project_id: "p-orion", path_id: "pa-orion", type: "access", detail: "Meridian Secure Gateway access must be usable",
    effective_date: "2026-11-06", affected_case_ids: ["ONB-015"], impact: "1 case gets a Meridian Secure Gateway access item.",
    status: "approved", submitted_by: "u-cm", approved_by: "u-admin", reason: "Needed for the PCI scope.", created_at: "2026-10-09" },
  { id: "req-003", client_id: "c-meridian", project_id: "p-vega", path_id: "pa-vega", type: "deadline", detail: "Everyone on Vega support ready by 30 Oct",
    effective_date: "2026-10-30", affected_case_ids: ["ONB-010"], impact: "1 expected readiness date set to 30 Oct (none recorded today).",
    status: "submitted", submitted_by: "u-cm", approved_by: null, reason: null, created_at: "2026-10-13" },
  { id: "req-004", client_id: "c-halden", project_id: "p-pulse", path_id: "pa-pulse", type: "compliance", detail: "Background check renewal for all Pulse staff",
    effective_date: null, affected_case_ids: ["ONB-008", "ONB-014"], impact: "2 cases get a compliance access item.",
    status: "rejected", submitted_by: "u-cm", approved_by: "u-admin", reason: "HR already tracks background checks outside onboarding.", created_at: "2026-10-06" },
];
db.client_requirements.push(...reqs);
const path_requirements = [
  { path_id: "pa-orion", requirement_id: "req-001", added_at: "2026-10-10" },
  { path_id: "pa-orion", requirement_id: "req-002", added_at: "2026-10-10" },
];

// ───────────────────────── new cases ONB-011..ONB-020 ─────────────────────────
db.users.push(
  user("u-e-011", "Sofia Kerr", "Application Support Engineer", "ONB-011"),
  user("u-e-012", "Dan Holt", "Service Desk Analyst", "ONB-012"),
  user("u-e-013", "Mira Solis", "Integration Developer", "ONB-013"),
  user("u-e-014", "Tariq Neal", "Data Analyst", "ONB-014"),
  user("u-e-015", "Elena Brandt", "Service Desk Analyst", "ONB-015"),
  user("u-e-016", "Jonah Reyes", "Operations Analyst", "ONB-016"),
  user("u-e-017", "Priya Anand", "Support Analyst", "ONB-017"),
  user("u-e-018", "Ruben Ortega", "Network Engineer", "ONB-018"),
  user("u-e-019", "Wes Calder", "Support Analyst", "ONB-019"),
  user("u-e-020", "Gia Moretti", "Integration Developer", "ONB-020"),
);

db.cases.push(
  // Closed upskill: full lifecycle, every core scope validated. Feeds benchmarks, on-time rate and A9.
  kase({ id: "ONB-011", employee_id: "u-e-011", movement_type: "upskill", project_id: "p-vega", role: "Application Support Engineer", path_id: "pa-vega", line_manager_id: "u-lm-alex", tl_id: "u-tl-vega", start_date: "2026-08-17", expected_ready_date: "2026-09-25", stage: "closed", outcome: "ready", tracker_status: "Closed", tracker_updated_at: "2026-09-28", profile_id: "wp-upskill", seniority: "mid" }),
  // Outcome set by the TL with one override: Ready with Support.
  kase({ id: "ONB-012", employee_id: "u-e-012", movement_type: "new_hire", project_id: "p-orion", role: "Service Desk Analyst", path_id: "pa-orion", line_manager_id: "u-lm-luca", tl_id: "u-tl-orion", start_date: "2026-09-07", expected_ready_date: "2026-10-16", stage: "outcome", outcome: "ready_with_support", tracker_status: "Ready with Support", tracker_updated_at: "2026-10-10", profile_id: "wp-default", seniority: "mid" }),
  // Setup: VPN approved and the employee says it works (A1 proposal waiting), ambiguous name match needs review.
  kase({ id: "ONB-013", employee_id: "u-e-013", movement_type: "new_hire", project_id: "p-nimbus", role: "Integration Developer", path_id: "pa-nimbus", line_manager_id: "u-lm-sara", tl_id: "u-tl-nimbus", start_date: "2026-10-12", expected_ready_date: "2026-11-20", stage: "setup", tracker_status: "Setup", tracker_updated_at: "2026-10-13", profile_id: "wp-default", seniority: "senior" }),
  // Rating gap: human 1:1 rating 8, AI rates the note 4.
  kase({ id: "ONB-014", employee_id: "u-e-014", movement_type: "reallocation", project_id: "p-pulse", role: "Data Analyst", path_id: "pa-pulse", line_manager_id: "u-lm-mark", tl_id: "u-tl-pulse", start_date: "2026-09-22", expected_ready_date: "2026-10-30", stage: "in_kt", tracker_status: "KT Started", tracker_updated_at: "2026-10-12", profile_id: "wp-transfer", seniority: "mid" }),
  // Client requirement applied: new scope, new access item, expected date moved earlier.
  kase({ id: "ONB-015", employee_id: "u-e-015", movement_type: "new_hire", project_id: "p-orion", role: "Service Desk Analyst", path_id: "pa-orion", line_manager_id: "u-lm-luca", tl_id: "u-tl-orion", start_date: "2026-09-28", expected_ready_date: "2026-11-06", stage: "in_kt", tracker_status: "On Track", tracker_updated_at: "2026-10-13", profile_id: "wp-newhire", seniority: "junior" }),
  // Future start, everything confirmed: the clean HR case (no flags).
  kase({ id: "ONB-016", employee_id: "u-e-016", movement_type: "new_hire", project_id: "p-atlas", role: "Operations Analyst", path_id: "pa-atlas", line_manager_id: "u-lm-maya", tl_id: "u-tl-atlas", start_date: "2026-10-19", expected_ready_date: "2026-11-27", stage: "pre_onboarding", tracker_status: "Pre-Onboarding", tracker_updated_at: "2026-10-13", profile_id: "wp-newhire", seniority: "junior" }),
  // Per-scope check-ins and pending A3 proposals; one AI extraction failed validation twice.
  kase({ id: "ONB-017", employee_id: "u-e-017", movement_type: "reallocation", project_id: "p-aurora", role: "Support Analyst", path_id: "pa-aurora", line_manager_id: "u-lm-jon", tl_id: "u-tl-aurora", start_date: "2026-10-05", expected_ready_date: "2026-11-04", stage: "in_kt", tracker_status: "Shadowing", tracker_updated_at: "2026-10-14", profile_id: "wp-transfer", seniority: "mid" }),
  // Closed loop: access delay answered by reply and resolved; one draft rejected.
  kase({ id: "ONB-018", employee_id: "u-e-018", movement_type: "new_hire", project_id: "p-nova", role: "Network Engineer", path_id: "pa-nova", line_manager_id: "u-lm-rita", tl_id: "u-tl-nova", start_date: "2026-09-29", expected_ready_date: "2026-11-06", stage: "in_kt", tracker_status: "KT Started", tracker_updated_at: "2026-10-13", profile_id: "wp-newhire", seniority: "junior" }),
  // At risk: low score after more days in KT than the path median; tracker still says On Track.
  kase({ id: "ONB-019", employee_id: "u-e-019", movement_type: "new_hire", project_id: "p-aurora", role: "Support Analyst", path_id: "pa-aurora", line_manager_id: "u-lm-jon", tl_id: "u-tl-aurora", start_date: "2026-09-14", expected_ready_date: "2026-10-23", stage: "in_kt", tracker_status: "On Track", tracker_updated_at: "2026-10-10", profile_id: "wp-newhire", seniority: "junior" }),
  // Blocked with a reason the employee reported: blocked flag with an owner, draft follow-up waiting for the PMO.
  kase({ id: "ONB-020", employee_id: "u-e-020", movement_type: "reallocation", project_id: "p-nimbus", role: "Integration Developer", path_id: "pa-nimbus", line_manager_id: "u-lm-sara", tl_id: "u-tl-nimbus", start_date: "2026-10-01", expected_ready_date: "2026-11-10", stage: "in_kt", tracker_status: "Blocked", tracker_updated_at: "2026-10-13", profile_id: "wp-transfer", seniority: "mid" }),
);

db.scopes.push(
  scope("s-011-1", "ONB-011", "Daily standard activities", "validated", "2026-09-22"),
  scope("s-011-2", "ONB-011", "Exception handling", "validated", "2026-09-24"),
  scope("s-011-3", "ONB-011", "Production changes", "validated", "2026-09-25"),
  scope("s-012-1", "ONB-012", "Standard service requests", "validated", "2026-10-08"),
  scope("s-012-2", "ONB-012", "Incident triage", "validated", "2026-10-08"),
  scope("s-012-3", "ONB-012", "Complex scenario: multi-system outage", "supported", "2026-10-09"),
  scope("s-013-1", "ONB-013", "Nimbus integration flows", "not_started", "2026-10-12"),
  scope("s-013-2", "ONB-013", "Release process", "not_started", "2026-10-12"),
  scope("s-014-1", "ONB-014", "Pulse data pipelines", "supported", "2026-10-09"),
  scope("s-014-2", "ONB-014", "Reporting dashboards", "shadowing", "2026-10-06"),
  scope("s-015-1", "ONB-015", "Standard service requests", "supported", "2026-10-10"),
  scope("s-015-2", "ONB-015", "Incident triage", "shadowing", "2026-10-07"),
  scope("s-015-3", "ONB-015", "PCI-DSS awareness training", "not_started", "2026-10-10", true, "req-001"),
  scope("s-016-1", "ONB-016", "Atlas daily operations", "not_started", "2026-10-13"),
  scope("s-016-2", "ONB-016", "Runbook procedures", "not_started", "2026-10-13"),
  scope("s-017-1", "ONB-017", "Aurora ticket handling", "supported", "2026-10-13"),
  scope("s-017-2", "ONB-017", "Knowledge base upkeep", "shadowing", "2026-10-09"),
  scope("s-018-1", "ONB-018", "Network monitoring", "supported", "2026-10-13"),
  scope("s-018-2", "ONB-018", "Change requests", "shadowing", "2026-10-08"),
  scope("s-019-1", "ONB-019", "Aurora ticket handling", "shadowing", "2026-09-30"),
  scope("s-019-2", "ONB-019", "Knowledge base upkeep", "not_started", "2026-09-14"),
  scope("s-020-1", "ONB-020", "Nimbus integration flows", "shadowing", "2026-10-08"),
  scope("s-020-2", "ONB-020", "Release process", "not_started", "2026-10-01"),
);

db.access_items.push(
  acc({ id: "ac-011-1", case_id: "ONB-011", system: "Vega console", state: "usable", requested_at: "2026-08-12", updated_at: "2026-08-17" }),
  acc({ id: "ac-011-2", case_id: "ONB-011", system: "ServiceNow (Vega)", state: "usable", requested_at: "2026-08-12", updated_at: "2026-08-18" }),
  acc({ id: "ac-012-1", case_id: "ONB-012", system: "Orion Portal", state: "usable", requested_at: "2026-09-01", updated_at: "2026-09-08" }),
  acc({ id: "ac-012-2", case_id: "ONB-012", system: "Helix Service Desk", state: "usable", requested_at: "2026-09-01", updated_at: "2026-09-09" }),
  acc({ id: "ac-013-1", case_id: "ONB-013", system: "Nova VPN", state: "approved", requested_at: "2026-10-12", updated_at: "2026-10-13", proposed_state: "usable",
    note: "Mira wrote in Teams that the VPN connects. A1 proposes usable; waiting for a person to confirm.", next_followup_at: "2026-10-15" }),
  acc({ id: "ac-013-2", case_id: "ONB-013", system: "GitLab (Nimbus)", state: "usable", requested_at: "2026-10-12", updated_at: "2026-10-12" }),
  acc({ id: "ac-013-3", case_id: "ONB-013", system: "Helix Service Desk", state: "requested", requested_at: "2026-10-12", updated_at: "2026-10-12", next_followup_at: "2026-10-16", note: "Requested at start. Owner: Access Support." }),
  acc({ id: "ac-014-1", case_id: "ONB-014", system: "Pulse data warehouse", state: "usable", requested_at: "2026-09-18", updated_at: "2026-09-22" }),
  acc({ id: "ac-014-2", case_id: "ONB-014", system: "BI workspace", state: "usable", requested_at: "2026-09-18", updated_at: "2026-09-23" }),
  acc({ id: "ac-015-1", case_id: "ONB-015", system: "Orion Portal", state: "usable", requested_at: "2026-09-22", updated_at: "2026-09-29" }),
  acc({ id: "ac-015-2", case_id: "ONB-015", system: "Helix Service Desk", state: "usable", requested_at: "2026-09-22", updated_at: "2026-09-30" }),
  acc({ id: "ac-015-3", case_id: "ONB-015", system: "Meridian Secure Gateway", state: "requested", requested_at: "2026-10-10", updated_at: "2026-10-10", next_followup_at: "2026-10-15", note: "Added by an approved client requirement (req-002)." }),
  acc({ id: "ac-016-1", case_id: "ONB-016", system: "Atlas Ops Console", state: "requested", requested_at: "2026-10-13", updated_at: "2026-10-13", next_followup_at: "2026-10-16" }),
  acc({ id: "ac-016-2", case_id: "ONB-016", system: "Email and Teams", state: "approved", requested_at: "2026-10-13", updated_at: "2026-10-14", note: "Account created; usable from the start date." }),
  acc({ id: "ac-017-1", case_id: "ONB-017", system: "Aurora ticketing", state: "usable", requested_at: "2026-10-01", updated_at: "2026-10-05" }),
  acc({ id: "ac-018-1", case_id: "ONB-018", system: "Nova NOC dashboard", state: "usable", requested_at: "2026-09-29", updated_at: "2026-10-12", owner_label: "Nova network team", note: "Granted 12 Oct after the PMO follow-up. Confirmed working by Ruben." }),
  acc({ id: "ac-018-2", case_id: "ONB-018", system: "Nova VPN", state: "usable", requested_at: "2026-09-25", updated_at: "2026-09-29" }),
  acc({ id: "ac-019-1", case_id: "ONB-019", system: "Aurora ticketing", state: "usable", requested_at: "2026-09-10", updated_at: "2026-09-15" }),
  acc({ id: "ac-020-1", case_id: "ONB-020", system: "GitLab (Nimbus)", state: "usable", requested_at: "2026-09-28", updated_at: "2026-10-01" }),
  acc({ id: "ac-020-2", case_id: "ONB-020", system: "Nimbus test environment", state: "approved", requested_at: "2026-09-28", updated_at: "2026-10-10", owner_label: "Nimbus platform team", note: "Account exists but the environment is down since 10 Oct.", next_followup_at: "2026-10-15" }),
);

db.evidence.push(
  // ONB-011 (closed)
  task("ev-t-011-1", "ONB-011", "s-011-1", "2026-09-01", "supported", "Ran daily checks with review", "Rhea Vance", "u-tl-vega"),
  task("ev-t-011-2", "ONB-011", "s-011-1", "2026-09-10", "independent", "Ran daily checks alone for a week", "Rhea Vance", "u-tl-vega"),
  task("ev-t-011-3", "ONB-011", "s-011-2", "2026-09-16", "independent", "Handled 4 exceptions alone; escalated 1 correctly", "Rhea Vance", "u-tl-vega"),
  task("ev-t-011-4", "ONB-011", "s-011-3", "2026-09-22", "independent", "Prepared and ran 2 production changes alone", "Rhea Vance", "u-tl-vega"),
  ev({ id: "ev-tl-011", case_id: "ONB-011", kind: "tl_review", author_role: "tl", author_label: "Rhea Vance (Tech Lead)", author_id: "u-tl-vega", occurred_at: "2026-09-25",
    summary: "All three scopes done alone with correct escalation. Ready.", claimed_status: "ready", value_0_100: 100, source_ref: "teams://vega-kt/review/ONB-011" }),
  // ONB-012 (outcome)
  task("ev-t-012-1", "ONB-012", "s-012-1", "2026-09-24", "independent", "Resolved 10 standard requests alone", "Ada Quinn", "u-tl-orion"),
  task("ev-t-012-2", "ONB-012", "s-012-2", "2026-10-01", "independent", "Triaged 6 incidents alone; escalated 2 correctly", "Ada Quinn", "u-tl-orion"),
  task("ev-t-012-3", "ONB-012", "s-012-3", "2026-10-07", "supported", "Outage drill with TL guiding steps 3-6", "Ada Quinn", "u-tl-orion"),
  ev({ id: "ev-tl-012", case_id: "ONB-012", kind: "tl_review", author_role: "tl", author_label: "Ada Quinn (Tech Lead)", author_id: "u-tl-orion", occurred_at: "2026-10-09",
    summary: "Standard work and triage alone. Outage handling still needs guidance. Ready with Support.", claimed_status: "ready_with_support", value_0_100: 75, source_ref: "outlook://ORI-330/thread/kt-weekly#2026-10-09" }),
  ev({ id: "ev-lm-012", case_id: "ONB-012", kind: "email", author_role: "lm", author_label: "Luca Gray (Line Manager)", author_id: "u-lm-luca", occurred_at: "2026-10-10",
    summary: "Agrees with the TL: operational on standard work, still supported on outages.", claimed_status: "ready_with_support", source_ref: "outlook://ORI-330/thread/lm-progress#2026-10-10" }),
  // ONB-013 (setup, A1 needs review)
  ev({ id: "ev-ai-013-1", case_id: "ONB-013", kind: "checkin", author_role: "employee", author_label: "Mira S. (Teams)", author_id: null, occurred_at: "2026-10-13",
    summary: "Sender 'Mira S.' says the VPN connects. Name is close to Mila Rowan (ONB-001), so the case match is low confidence.", status: "needs_review", simulated: true,
    source_ref: "teams://axon-bot/dm/2026-10-13T09:12" }),
  // ONB-014 (rating gap)
  task("ev-t-014-1", "ONB-014", "s-014-1", "2026-10-05", "supported", "Restarted a failed load with TL guidance", "Ivo Sand", "u-tl-pulse"),
  task("ev-t-014-2", "ONB-014", "s-014-1", "2026-10-09", "supported", "Fixed a schema drift issue under review", "Ivo Sand", "u-tl-pulse", true),
  task("ev-t-014-3", "ONB-014", "s-014-2", "2026-10-06", "shadowing", "Observed dashboard refresh process", "Ivo Sand", "u-tl-pulse"),
  // ONB-015 (client requirement)
  task("ev-t-015-1", "ONB-015", "s-015-1", "2026-10-06", "supported", "Resolved 5 standard requests with a reviewer", "Ada Quinn", "u-tl-orion"),
  task("ev-t-015-2", "ONB-015", "s-015-1", "2026-10-10", "supported", "Resolved 7 standard requests, 1 reworked", "Ada Quinn", "u-tl-orion", true),
  task("ev-t-015-3", "ONB-015", "s-015-2", "2026-10-07", "shadowing", "Observed incident triage shift", "Ada Quinn", "u-tl-orion"),
  // ONB-016 (future start)
  ev({ id: "ev-hr-016", case_id: "ONB-016", kind: "email", author_role: "hr", author_label: "Hana Brooks (HR)", author_id: "u-hr", occurred_at: "2026-10-13",
    summary: "Start 19 Oct confirmed: Atlas, Operations Analyst, Maya Ford (LM), Ben Royce (TL and KT owner).", source_ref: "outlook://ATL-512/thread/new-start-jonah#msg-1", extracted_by: "ai" }),
  // ONB-017 (per-scope check-ins; AI output failed validation)
  task("ev-t-017-1", "ONB-017", "s-017-1", "2026-10-08", "shadowing", "Observed ticket handling", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-017-2", "ONB-017", "s-017-1", "2026-10-13", "supported", "Handled 4 tickets with a reviewer", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-017-3", "ONB-017", "s-017-2", "2026-10-09", "shadowing", "Observed a knowledge base update", "Kai Brennan", "u-tl-aurora"),
  ev({ id: "ev-ai-017-1", case_id: "ONB-017", kind: "email", author_role: "tl", author_label: "Kai Brennan (Tech Lead)", author_id: "u-tl-aurora", occurred_at: "2026-10-14",
    summary: "Weekly KT note could not be split into scopes: output failed schema validation twice. Needs a PMO check.", status: "needs_review",
    source_ref: "outlook://AUR-114/thread/kt-weekly#2026-10-14" }),
  // ONB-018 (closed loop)
  ev({ id: "ev-email-018-1", case_id: "ONB-018", kind: "email", author_role: "access_support", author_label: "Nova network team", occurred_at: "2026-10-12",
    summary: "Reply to the PMO follow-up: NOC dashboard access granted today.", source_ref: "outlook://NOV-161/thread/noc-access-ruben#msg-2" }),
  task("ev-t-018-1", "ONB-018", "s-018-1", "2026-10-06", "shadowing", "Observed monitoring shift", "Cleo Marsh", "u-tl-nova"),
  task("ev-t-018-2", "ONB-018", "s-018-1", "2026-10-13", "supported", "Ran a monitoring shift with Cleo reviewing", "Cleo Marsh", "u-tl-nova"),
  task("ev-t-018-3", "ONB-018", "s-018-2", "2026-10-08", "shadowing", "Observed a change request review", "Cleo Marsh", "u-tl-nova"),
  // ONB-019 (at risk)
  ev({ id: "ev-tr-019", case_id: "ONB-019", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-10", summary: "Status On Track.", claimed_status: "on_track",
    source_ref: "tracker://onboarding.xlsx/row/ONB-019", extracted_by: "manual", simulated: false }),
  task("ev-t-019-1", "ONB-019", "s-019-1", "2026-09-22", "shadowing", "Observed ticket handling", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-019-2", "ONB-019", "s-019-1", "2026-09-30", "shadowing", "Observed ticket handling again; did not take a ticket", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-019-3", "ONB-019", "s-019-1", "2026-10-09", "supported", "First supported ticket; reworked after review", "Kai Brennan", "u-tl-aurora", true),
  // ONB-020 (blocked with reason)
  ev({ id: "ev-bl-020", case_id: "ONB-020", kind: "checkin", author_role: "employee", author_label: "Gia Moretti (self)", author_id: "u-e-020", occurred_at: "2026-10-13",
    summary: "Reported blocker: the Nimbus test environment is down since 10 Oct, so integration tasks cannot run.", source_ref: "axon://blocker/ONB-020/2026-10-13", extracted_by: "manual", simulated: false }),
  ev({ id: "ev-tr-020", case_id: "ONB-020", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-13", summary: "Status Blocked.", claimed_status: "blocked",
    source_ref: "tracker://onboarding.xlsx/row/ONB-020", extracted_by: "manual", simulated: false }),
  task("ev-t-020-1", "ONB-020", "s-020-1", "2026-10-08", "shadowing", "Observed an integration flow deployment", "Petra Lind", "u-tl-nimbus"),
);

db.validations.push(
  val("va-011-1", "ONB-011", "s-011-1", "u-tl-vega", "independent", 0.9, "A week of daily checks alone after one supported run.", ["ev-t-011-1", "ev-t-011-2"], { level: "validated", at: "2026-09-22", reason: "Observed alone for a week." }),
  val("va-011-2", "ONB-011", "s-011-2", "u-tl-vega", "independent", 0.84, "Exceptions handled alone with a correct escalation.", ["ev-t-011-3"], { level: "validated", at: "2026-09-24", reason: "Correct escalation seen." }),
  val("va-011-3", "ONB-011", "s-011-3", "u-tl-vega", "independent", 0.82, "Two production changes alone.", ["ev-t-011-4"], { level: "validated", at: "2026-09-25", reason: "Changes reviewed after the fact, no issues." }),
  val("va-012-1", "ONB-012", "s-012-1", "u-tl-orion", "independent", 0.9, "Ten standard requests alone, no rework.", ["ev-t-012-1"], { level: "validated", at: "2026-10-08", reason: "Matches what I saw." }),
  val("va-012-2", "ONB-012", "s-012-2", "u-tl-orion", "independent", 0.82, "Six incidents alone with two correct escalations.", ["ev-t-012-2"], { level: "validated", at: "2026-10-08", reason: "Matches what I saw." }),
  // TL override of the AI proposal, with the mandatory reason.
  val("va-012-3", "ONB-012", "s-012-3", "u-tl-orion", "independent", 0.58, "Drill completed; steps 3-6 done.", ["ev-t-012-3"], { level: "supported", at: "2026-10-09", reason: "I guided steps 3-6, so he is not yet independent on outages." }),
  val("va-014-1", "ONB-014", "s-014-1", "u-tl-pulse", "supported", 0.66, "Two pipeline tasks under review, one reworked.", ["ev-t-014-1", "ev-t-014-2"]),
  val("va-015-1", "ONB-015", "s-015-1", "u-tl-orion", "supported", 0.7, "Standard requests with a reviewer; one rework.", ["ev-t-015-1", "ev-t-015-2"]),
  val("va-017-1", "ONB-017", "s-017-1", "u-tl-aurora", "supported", 0.68, "Moved from shadowing to supported tickets this week.", ["ev-t-017-1", "ev-t-017-2"]),
  val("va-017-2", "ONB-017", "s-017-2", "u-tl-aurora", "shadowing", 0.72, "Only observed so far.", ["ev-t-017-3"]),
  val("va-018-1", "ONB-018", "s-018-1", "u-tl-nova", "supported", 0.67, "One monitoring shift with review.", ["ev-t-018-1", "ev-t-018-2"]),
);

db.one_on_ones.push(
  { id: "oo-011-1", case_id: "ONB-011", rater_id: "u-tl-vega", rating_human: 9, rating_ai: 9, note: "Explains every check and when to escalate. Ready.", held_at: "2026-09-23" },
  { id: "oo-011-2", case_id: "ONB-011", rater_id: "u-lm-alex", rating_human: 8, rating_ai: 8, note: "Confident and settled in the team.", held_at: "2026-09-26" },
  { id: "oo-012-1", case_id: "ONB-012", rater_id: "u-tl-orion", rating_human: 8, rating_ai: 7, note: "Solid on standard work; unsure on outage order of steps.", held_at: "2026-10-06" },
  { id: "oo-014-1", case_id: "ONB-014", rater_id: "u-lm-mark", rating_human: 8, rating_ai: 4, note: "Says everything is fine. Could not explain how to restart a failed load or who to call.", held_at: "2026-10-13" },
  { id: "oo-015-1", case_id: "ONB-015", rater_id: "u-tl-orion", rating_human: 6, rating_ai: 6, note: "Learning quickly; has not seen an incident alone yet.", held_at: "2026-10-10" },
  { id: "oo-019-1", case_id: "ONB-019", rater_id: "u-lm-jon", rating_human: 4, rating_ai: 3, note: "Still watching rather than doing. Not sure who to ask for help.", held_at: "2026-10-08" },
);

db.checkins.push(
  { id: "ci-011-1", case_id: "ONB-011", scope_id: null, self_score: 9, kt_rating: 5, doc_rating: 4, note: "Feedback submitted at close.", at: "2026-09-27" },
  { id: "ci-012-1", case_id: "ONB-012", scope_id: null, self_score: 8, kt_rating: 4, doc_rating: 3, note: "Outage runbook is hard to follow.", at: "2026-10-10" },
  { id: "ci-014-1", case_id: "ONB-014", scope_id: null, self_score: 8, kt_rating: 3, doc_rating: 2, note: "All good.", at: "2026-10-12" },
  { id: "ci-015-1", case_id: "ONB-015", scope_id: null, self_score: 6, kt_rating: 4, doc_rating: 4, note: "Did not know about the PCI training until this week.", at: "2026-10-13" },
  { id: "ci-017-1", case_id: "ONB-017", scope_id: "s-017-1", self_score: 6, kt_rating: 4, doc_rating: 4, note: "Tickets are fine with a reviewer.", at: "2026-10-13" },
  { id: "ci-017-2", case_id: "ONB-017", scope_id: "s-017-2", self_score: 3, kt_rating: 3, doc_rating: 1, note: "No document for the knowledge base process.", at: "2026-10-13" },
  { id: "ci-018-1", case_id: "ONB-018", scope_id: null, self_score: 6, kt_rating: 4, doc_rating: 4, note: "NOC access works now.", at: "2026-10-13" },
  { id: "ci-019-1", case_id: "ONB-019", scope_id: null, self_score: 3, kt_rating: 2, doc_rating: 3, note: "I mostly watch. Not sure when I can take tickets alone.", at: "2026-10-09" },
  { id: "ci-020-1", case_id: "ONB-020", scope_id: null, self_score: 4, kt_rating: 4, doc_rating: 3, note: "Waiting for the test environment.", at: "2026-10-13" },
);

db.challenge_results.push(
  { id: "cr-011-1", case_id: "ONB-011", challenge_id: "ch-vega-2", score: 92, reviewed_by: "u-tl-vega", submitted_at: "2026-09-20" },
  { id: "cr-012-1", case_id: "ONB-012", challenge_id: "ch-orion-1", score: 84, reviewed_by: "u-tl-orion", submitted_at: "2026-10-02" },
  { id: "cr-012-2", case_id: "ONB-012", challenge_id: "ch-orion-2", score: 78, reviewed_by: "u-tl-orion", submitted_at: "2026-10-05" },
  { id: "cr-017-1", case_id: "ONB-017", challenge_id: "ch-aurora-1", score: null, reviewed_by: null, submitted_at: "2026-10-14" },
  { id: "cr-019-1", case_id: "ONB-019", challenge_id: "ch-aurora-1", score: 35, reviewed_by: "u-tl-aurora", submitted_at: "2026-10-07" },
);

db.stage_history.push(
  ...hist("ONB-011", [["pre_onboarding", "2026-08-10"], ["setup", "2026-08-17"], ["in_kt", "2026-08-19"], ["awaiting_validation", "2026-09-21"], ["outcome", "2026-09-25"], ["closed", "2026-09-28"]]),
  ...hist("ONB-012", [["pre_onboarding", "2026-09-01"], ["setup", "2026-09-07"], ["in_kt", "2026-09-10"], ["awaiting_validation", "2026-10-06"], ["outcome", "2026-10-09"]]),
  ...hist("ONB-013", [["pre_onboarding", "2026-10-05"], ["setup", "2026-10-12"]]),
  ...hist("ONB-014", [["pre_onboarding", "2026-09-16"], ["setup", "2026-09-22"], ["in_kt", "2026-09-24"]]),
  ...hist("ONB-015", [["pre_onboarding", "2026-09-21"], ["setup", "2026-09-28"], ["in_kt", "2026-10-01"]]),
  ...hist("ONB-016", [["pre_onboarding", "2026-10-13"]]),
  ...hist("ONB-017", [["pre_onboarding", "2026-09-30"], ["setup", "2026-10-05"], ["in_kt", "2026-10-07"]]),
  ...hist("ONB-018", [["pre_onboarding", "2026-09-22"], ["setup", "2026-09-29"], ["in_kt", "2026-10-02"]]),
  ...hist("ONB-019", [["pre_onboarding", "2026-09-08"], ["setup", "2026-09-14"], ["in_kt", "2026-09-17"]]),
  ...hist("ONB-020", [["pre_onboarding", "2026-09-25"], ["setup", "2026-10-01"], ["in_kt", "2026-10-03"]]),
);

// Actions sent before the rules run (so rule_unanswered sees the same thing the app does).
db.actions.push(
  { id: "act-018-1", case_id: "ONB-018", flag_id: "fl-access_delay-ONB-018", channel: "outlook", recipient: "Nova network team", recipient_role: "Access owner",
    subject: "Nova NOC dashboard access for Ruben Ortega", body: "Hello, Ruben Ortega's NOC dashboard access was requested on 29 Sep and is not usable yet. Could you grant it or give a date by 12 Oct?",
    due_at: "2026-10-12", status: "answered", approved_by: "u-pmo", thread_ref: "outlook://NOV-161/thread/noc-access-ruben", evidence_ids: [], created_at: "2026-10-09",
    sent_at: "2026-10-09", answered_at: "2026-10-12", reply_summary: "Access granted on 12 Oct.", reject_reason: null },
  { id: "act-018-2", case_id: "ONB-018", flag_id: "fl-access_delay-ONB-018", channel: "teams", recipient: "Ruben Ortega", recipient_role: "Employee",
    body: "Hi Ruben, please chase the Nova network team about your NOC dashboard access.", due_at: "2026-10-11", status: "rejected", approved_by: null,
    thread_ref: "teams://axon-bot/ONB-018/draft-2", evidence_ids: [], created_at: "2026-10-09", reject_reason: "The employee should not chase access; it goes to the access owner." },
);

// ───────────────────────── rules engine ─────────────────────────
runRules(db);

// Flags that are not rule output: resolved history, and flags people or agents raise (A6, A10, C6 blocker, at-risk).
const mflag = (x: Partial<Flag> & { manually_resolved?: boolean } & Pick<Flag, "id" | "case_id" | "type" | "severity" | "owner_label" | "raised_at" | "detail">): Flag => ({
  cause_class: null, cause_confirmed: false, owner_id: null, suggested_owner: null, due_at: addDays(x.raised_at, x.severity === "high" ? 1 : 3),
  status: "open", evidence_ids: [], root_cause: null, origin: "manual", ...x,
});
const extraFlags: (Flag & { manually_resolved?: boolean })[] = [
  mflag({ id: "fl-access_delay-ONB-018", case_id: "ONB-018", type: "access_delay", severity: "high", owner_label: "Nova network team", raised_at: "2026-10-05",
    detail: "1 system not usable 6 days after request: Nova NOC dashboard (requested).", cause_class: "external", cause_confirmed: true, origin: "rule", rule: "rule_access_delay",
    suggested_owner: "Nova network team", root_cause: "The NOC dashboard request went to a team without a follow-up date.", status: "resolved", resolved_at: "2026-10-12",
    resolution: "Reply from the Nova network team on 12 Oct: access granted. Ruben confirmed it works.", evidence_ids: ["ev-email-018-1"] }),
  mflag({ id: "fl-rating_gap-ONB-014", case_id: "ONB-014", type: "rating_gap", severity: "medium", owner_label: "Mark Hale (LM)", owner_id: "u-lm-mark", raised_at: "2026-10-13",
    detail: "1:1 on 13 Oct: Mark rated 8/10, the AI rated the note 4/10 (gap 4, threshold 2).", cause_class: "individual", suggested_owner: "Ivo Sand (TL)",
    root_cause: "The note describes gaps the rating does not reflect; a TL view of the pipeline scope would settle it.", evidence_ids: ["oo-014-1"] }),
  mflag({ id: "fl-client_requirement-ONB-015", case_id: "ONB-015", type: "client_requirement", severity: "medium", owner_label: "Ada Quinn (TL)", owner_id: "u-tl-orion", raised_at: "2026-10-10",
    detail: "Meridian requirement req-001 added the PCI-DSS awareness scope and moved the expected date to 6 Nov. The TL gate is closed again until it is validated.",
    cause_class: "external", cause_confirmed: true, suggested_owner: "Ada Quinn (TL)" }),
  mflag({ id: "fl-blocked-ONB-020", case_id: "ONB-020", type: "blocked", severity: "high", owner_label: "Petra Lind (TL)", owner_id: "u-tl-nimbus", raised_at: "2026-10-13",
    detail: "Employee reported: the Nimbus test environment is down since 10 Oct, so integration tasks cannot run.", cause_class: "external", cause_confirmed: true,
    suggested_owner: "Nimbus platform team", root_cause: "A shared environment outage outside the team blocks all hands-on KT.", evidence_ids: ["ev-bl-020", "ev-tr-020"] }),
  mflag({ id: "fl-at_risk-ONB-019", case_id: "ONB-019", type: "at_risk", severity: "high", owner_label: "Kai Brennan (TL)", owner_id: "u-tl-aurora", raised_at: "2026-10-14",
    detail: "Not ready after 27 days in KT (path median 19). The tracker still says On Track.", cause_class: "individual", suggested_owner: "Jon Vale (LM)",
    root_cause: "Mostly shadowing with no plan to move to supported work; the check-in says he does not know when he can take tickets alone.",
    evidence_ids: ["ev-t-019-1", "ev-t-019-2", "ev-t-019-3"] }),
  mflag({ id: "fl-missing_info-ONB-017", case_id: "ONB-017", type: "missing_info", severity: "low", owner_label: "Sam Ortiz (PMO)", owner_id: "u-pmo", raised_at: "2026-10-09",
    detail: "Knowledge base upkeep has no document on record.", cause_class: "compliance", cause_confirmed: true, status: "resolved", resolved_at: "2026-10-13",
    resolution: "Kai confirmed there is no written process; tracked as a path suggestion instead.", manually_resolved: true }),
];
db.flags.push(...extraFlags);
db.resolved_flag_ids.push(...extraFlags.filter((f) => f.manually_resolved).map((f) => f.id));

db.actions.push(
  { id: "act-019-1", case_id: "ONB-019", flag_id: "fl-at_risk-ONB-019", channel: "teams", recipient: "Kai Brennan", recipient_role: "Tech Lead",
    body: "Hi Kai, Wes Calder has been in KT for 27 days and is still mostly shadowing (path median is 19). Could you plan two supported ticket sessions for him this week?",
    due_at: "2026-10-16", status: "approved", approved_by: "u-pmo", thread_ref: "teams://axon-bot/ONB-019/at-risk", evidence_ids: ["ev-t-019-2", "ev-t-019-3"], created_at: "2026-10-14" },
  { id: "act-020-1", case_id: "ONB-020", flag_id: "fl-blocked-ONB-020", channel: "outlook", recipient: "Nimbus platform team", recipient_role: "Environment owner",
    subject: "Nimbus test environment down since 10 Oct", body: "Hello, the Nimbus test environment has been down since 10 Oct and blocks Gia Moretti's onboarding tasks. Could you share a restore date by 16 Oct?",
    due_at: "2026-10-16", status: "draft", approved_by: null, thread_ref: "outlook://NIM-482/thread/test-env-down", evidence_ids: ["ev-bl-020"], created_at: "2026-10-14" },
  { id: "act-014-1", case_id: "ONB-014", flag_id: "fl-rating_gap-ONB-014", channel: "teams", recipient: "Ivo Sand", recipient_role: "Tech Lead",
    body: "Hi Ivo, Tariq Neal's 1:1 rating and the meeting note disagree. Could you check his pipeline scope in the validation queue by 17 Oct?",
    due_at: "2026-10-17", status: "draft", approved_by: null, thread_ref: "teams://axon-bot/ONB-014/rating-gap", evidence_ids: ["oo-014-1"], created_at: "2026-10-14" },
);
runRules(db); // re-run so nothing above re-opens or duplicates a rule flag

// ───────────────────────── score snapshots ─────────────────────────
type Snap = { id: string; case_id: string; score: number; band: string; completeness: number; capped: boolean; breakdown: unknown; profile_id: string | null; computed_at: string; simulated: boolean };
const sim = (case_id: string, pts: [string, number, number][]) => pts.map(([d, sc, comp]) =>
  ({ case_id, score: sc, completeness: comp, capped: false, computed_at: d, simulated: true, band: bandFor(sc, db)! }));
db.score_snapshots.push(
  ...sim("ONB-011", [["2026-08-28", 35, 40], ["2026-09-08", 62, 70], ["2026-09-18", 84, 100]]),
  ...sim("ONB-012", [["2026-09-20", 48, 45], ["2026-10-01", 70, 80]]),
  ...sim("ONB-014", [["2026-10-01", 40, 35], ["2026-10-08", 51, 60]]),
  ...sim("ONB-019", [["2026-09-24", 18, 25], ["2026-10-03", 24, 40]]),
);
const snapshots: Snap[] = db.score_snapshots.map((s) => ({
  id: `ss-${s.case_id}-${s.computed_at}`, case_id: s.case_id, score: s.score, band: s.band, completeness: s.completeness, capped: s.capped,
  breakdown: null, profile_id: db.cases.find((c) => c.id === s.case_id)!.profile_id, computed_at: s.computed_at, simulated: !!s.simulated,
}));
for (const c of db.cases) {
  const r = computeScore(db, c.id);
  if (r.score == null || r.band == null) continue;
  snapshots.push({ id: `ss-${c.id}-${TODAY}`, case_id: c.id, score: r.score, band: r.band, completeness: r.completeness, capped: r.capped,
    breakdown: { raw: r.raw, tl_gate_passed: r.tl_gate_passed, provisional: r.provisional, components: r.components },
    profile_id: r.profile_id, computed_at: c.stage === "closed" ? "2026-09-28" : TODAY, simulated: false });
}

// ───────────────────────── done steps, audit log, config ─────────────────────────
const done_steps = [
  { step_key: "acc-ac-018-1", case_id: "ONB-018", done_at: "2026-10-12" },
  { step_key: "doc-ONB-016", case_id: "ONB-016", done_at: "2026-10-14" },
  { step_key: "kt-s-017-1-shadowing", case_id: "ONB-017", done_at: "2026-10-13" },
];

const audit: { id: string; actor: string; actor_id: string | null; action: string; entity: string; entity_id: string; payload: unknown; agent: string | null; model: string | null; at: string }[] = [];
let n = 0;
const log = (at: string, actor: string, actor_id: string | null, action: string, entity: string, entity_id: string, payload: unknown = null, agent: string | null = null) =>
  audit.push({ id: `au-${String(++n).padStart(4, "0")}`, actor, actor_id, action, entity, entity_id, payload, agent, model: agent ? "mock-cache" : null, at: `${at}T09:00:00Z` });
for (const e of db.evidence.filter((x) => x.extracted_by === "ai"))
  log(e.occurred_at, "A1 Evidence Extractor", null, "extract_evidence", "evidence", e.id, { source_ref: e.source_ref, status: e.status }, "A1 Evidence Extractor");
for (const f of db.flags.filter((x) => x.root_cause))
  log(f.raised_at, "A2 Root-Cause Analyst", null, "analyze_flag", "flags", f.id, { cause_class: f.cause_class, suggested_owner: f.suggested_owner }, "A2 Root-Cause Analyst");
for (const v of db.validations) {
  log(addDays(v.decided_at ?? TODAY, -1), "A3 Readiness Assessor", null, "propose_level", "validations", v.id, { proposed_level: v.proposed_level, confidence: v.confidence }, "A3 Readiness Assessor");
  if (v.decided_at) log(v.decided_at, `${db.users.find((u) => u.id === v.decided_by)!.name} (Tech Lead)`, v.decided_by, "decide_validation", "validations", v.id, { decided_level: v.decided_level, reason: v.reason });
}
for (const a of db.actions) {
  log(a.created_at, "A4 Next-Action Drafter", null, "draft_action", "actions", a.id, { flag_id: a.flag_id, channel: a.channel }, "A4 Next-Action Drafter");
  if (a.approved_by) log(a.sent_at ?? a.created_at, "Sam Ortiz (PMO Coordinator)", "u-pmo", "approve_action", "actions", a.id);
  if (a.status === "rejected") log(a.created_at, "Sam Ortiz (PMO Coordinator)", "u-pmo", "reject_action", "actions", a.id, { reason: a.reject_reason });
  if (a.answered_at) log(a.answered_at, "A5 Reply Listener", null, "match_reply", "actions", a.id, { reply_summary: a.reply_summary }, "A5 Reply Listener");
}
for (const o of db.one_on_ones.filter((x) => x.rating_ai != null))
  log(o.held_at, "A6 1:1 Scorer", null, "score_1on1", "one_on_ones", o.id, { rating_human: o.rating_human, rating_ai: o.rating_ai }, "A6 1:1 Scorer");
for (const r of reqs) {
  log(r.created_at, "A10 Requirements Assistant", null, "parse_requirement", "client_requirements", r.id, { type: r.type }, "A10 Requirements Assistant");
  if (r.status === "approved" || r.status === "rejected")
    log(addDays(r.created_at, 1), "Tess Albright (Platform Admin)", "u-admin", r.status === "approved" ? "approve_requirement" : "reject_requirement", "client_requirements", r.id, { reason: r.reason });
}
log("2026-10-13", "Sam Ortiz (PMO Coordinator)", "u-pmo", "resolve_flag", "flags", "fl-missing_info-ONB-017", { reason: "No written process; tracked as a path suggestion." });
log("2026-10-14", "Sam Ortiz (PMO Coordinator)", "u-pmo", "confirm_cause", "flags", "fl-blocked-ONB-020", { cause: "external" });
audit.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

db.path_suggestions.push(
  { id: "ps-4", path_id: "pa-aurora", suggestion: "Write a short knowledge base upkeep guide; two people on this path rated docs 1-3.", cause_flag_ids: ["fl-missing_info-ONB-017"], status: "approved", approved_by: "u-pmo" },
  { id: "ps-5", path_id: "pa-aurora", suggestion: "Move new hires from shadowing to supported tickets by day 10.", cause_flag_ids: ["fl-at_risk-ONB-019"], status: "proposed", approved_by: null },
  { id: "ps-6", path_id: "pa-nimbus", suggestion: "Give a fallback environment in the KT plan when the shared test environment is down.", cause_flag_ids: ["fl-blocked-ONB-020"], status: "rejected", approved_by: "u-pmo" },
);

const config = [
  { key: "app_today", value: TODAY, description: "Fixed app clock for the demo. Delete the row to use the real date." },
  { key: "stale_days", value: db.config.stale_days, description: "rule_stale: days without an update before a case is stale." },
  { key: "escalate_days", value: db.config.escalate_days, description: "rule_access_delay / rule_unanswered: days before escalation." },
  { key: "tl_cap", value: db.config.tl_cap, description: "Score cap until the TL validates every core scope." },
  { key: "provisional_below", value: db.config.provisional_below, description: "Completeness % below which a score is provisional." },
  { key: "rating_gap", value: db.config.rating_gap, description: "A6: human vs AI 1:1 rating difference that raises a flag." },
  { key: "bands", value: db.config.bands, description: "Lower bound of each readiness band." },
];

// ───────────────────────── emit ─────────────────────────
type Col = [name: string, kind?: "array" | "json"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLES: [table: string, cols: Col[], rows: any[]][] = [
  ["clients", [["id"], ["name"]], db.clients],
  ["projects", [["id"], ["name"], ["code"], ["client_id"]], db.projects],
  ["paths", [["id"], ["project_id"], ["role_name"]], db.paths],
  ["users", [["id"], ["name"], ["email"], ["role"], ["title"], ["project_id"], ["case_id"]], db.users],
  ["weight_profiles", [["id"], ["name"], ["w_work"], ["w_tl"], ["w_1on1_human"], ["w_1on1_ai"], ["w_challenge"], ["w_self"], ["version"], ["active"]], db.weight_profiles],
  ["config", [["key"], ["value", "json"], ["description"]], config],
  ["cases", [["id"], ["employee_id"], ["movement_type"], ["project_id"], ["role"], ["path_id"], ["line_manager_id"], ["tl_id"], ["start_date"], ["expected_ready_date"], ["stage"], ["outcome"], ["tracker_status"], ["tracker_updated_at"], ["profile_id"], ["seniority"]], db.cases],
  ["client_requirements", [["id"], ["client_id"], ["project_id"], ["path_id"], ["type"], ["detail"], ["effective_date"], ["affected_case_ids", "array"], ["impact"], ["status"], ["submitted_by"], ["approved_by"], ["reason"], ["created_at"]], db.client_requirements],
  ["path_requirements", [["path_id"], ["requirement_id"], ["added_at"]], path_requirements],
  ["scopes", [["id"], ["case_id"], ["name"], ["is_core"], ["level"], ["level_updated_at"], ["added_by_requirement"]], db.scopes],
  ["access_items", [["id"], ["case_id"], ["system"], ["state"], ["owner_label"], ["requested_at"], ["updated_at"], ["next_followup_at"], ["note"], ["proposed_state"]], db.access_items],
  ["evidence", [["id"], ["case_id"], ["scope_id"], ["kind"], ["author_role"], ["author_label"], ["author_id"], ["source_ref"], ["occurred_at"], ["summary"], ["claimed_status"], ["support_level"], ["reworked"], ["value_0_100"], ["disputed"], ["extracted_by"], ["status"], ["simulated"]], db.evidence],
  ["flags", [["id"], ["case_id"], ["type"], ["severity"], ["cause_class"], ["cause_confirmed"], ["owner_id"], ["owner_label"], ["suggested_owner"], ["raised_at"], ["due_at"], ["status"], ["evidence_ids", "array"], ["detail"], ["root_cause"], ["origin"], ["rule"], ["resolved_at"], ["resolution"], ["manually_resolved"]], db.flags],
  ["actions", [["id"], ["case_id"], ["flag_id"], ["channel"], ["recipient"], ["recipient_role"], ["subject"], ["body"], ["due_at"], ["status"], ["approved_by"], ["thread_ref"], ["evidence_ids", "array"], ["created_at"], ["sent_at"], ["answered_at"], ["reply_summary"], ["reject_reason"]], db.actions],
  ["validations", [["id"], ["case_id"], ["scope_id"], ["tl_id"], ["proposed_level"], ["proposed_by"], ["evidence_ids", "array"], ["confidence"], ["rationale"], ["decided_level"], ["reason"], ["decided_at"], ["decided_by"]], db.validations],
  ["score_snapshots", [["id"], ["case_id"], ["score"], ["band"], ["completeness"], ["capped"], ["breakdown", "json"], ["profile_id"], ["computed_at"], ["simulated"]], snapshots],
  ["audit_log", [["id"], ["actor"], ["actor_id"], ["action"], ["entity"], ["entity_id"], ["payload", "json"], ["agent"], ["model"], ["at"]], audit],
  ["one_on_ones", [["id"], ["case_id"], ["rater_id"], ["rating_human"], ["rating_ai"], ["note"], ["held_at"]], db.one_on_ones],
  ["checkins", [["id"], ["case_id"], ["scope_id"], ["self_score"], ["kt_rating"], ["doc_rating"], ["note"], ["at"]], db.checkins],
  ["stage_history", [["case_id"], ["stage"], ["entered_at"]], db.stage_history],
  ["doc_references", [["id"], ["project_id"], ["path_id"], ["title"], ["folder_ref"], ["owner_label"], ["verified_at"]], db.doc_references],
  ["done_steps", [["step_key"], ["case_id"], ["done_at"]], done_steps],
  ["skills", [["id"], ["path_id"], ["name"], ["doc_ref"], ["coverage"], ["last_updated"]], db.skills],
  ["challenges", [["id"], ["skill_id"], ["prompt"], ["approved_by"], ["created_by"]], db.challenges],
  ["challenge_results", [["id"], ["case_id"], ["challenge_id"], ["score"], ["reviewed_by"], ["submitted_at"]], db.challenge_results],
  ["benchmarks", [["path_id"], ["stage"], ["median_days"], ["n_completed"], ["provisional"]], db.benchmarks],
  ["path_suggestions", [["id"], ["path_id"], ["suggestion"], ["cause_flag_ids", "array"], ["status"], ["approved_by"]], db.path_suggestions],
];

const norm = (row: Record<string, unknown>, [name]: Col) => {
  const v = row[name];
  if (v === undefined) return name === "manually_resolved" || name === "simulated" ? false : null;
  return v;
};
const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sqlVal = (v: unknown, kind?: Col[1]) => {
  if (v === null) return "null";
  if (kind === "json") return `${sqlStr(JSON.stringify(v))}::jsonb`;
  if (kind === "array") return (v as string[]).length ? `array[${(v as string[]).map(sqlStr).join(", ")}]` : "'{}'";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return sqlStr(String(v));
};
const pgArray = (xs: string[]) => `{${xs.map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;
const csvCell = (v: unknown, kind?: Col[1]) => {
  if (v === null) return "";
  const s = kind === "json" ? JSON.stringify(v) : kind === "array" ? pgArray(v as string[]) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const sql: string[] = [
  "-- AXON mock data. GENERATED by supabase/scripts/generate-seed.ts. Do not edit by hand; edit the script and re-run it.",
  "-- ONB-001..ONB-010 come from the Student Starter Pack (via axon_initial_template_front/lib/seed.ts).",
  "-- ONB-011..ONB-020 are fictional extensions. Rows with simulated = true are labelled \"Simulated\" in the UI.",
  "-- Flags and the 2026-10-14 score snapshots are computed by the app's own rules engine and score service.",
  "begin;",
];
const json: Record<string, unknown> = {};
mkdirSync(join(OUT, "data", "csv"), { recursive: true });
for (const [table, cols, rows] of TABLES) {
  json[table] = rows.map((r) => Object.fromEntries(cols.map((c) => [c[0], norm(r, c)])));
  writeFileSync(join(OUT, "data", "csv", `${table}.csv`),
    [cols.map((c) => c[0]).join(","), ...rows.map((r) => cols.map((c) => csvCell(norm(r, c), c[1])).join(","))].join("\n") + "\n");
  if (!rows.length) continue;
  sql.push("", `-- ${table} (${rows.length})`, `insert into ${table} (${cols.map((c) => c[0]).join(", ")}) values`);
  sql.push(rows.map((r) => `  (${cols.map((c) => sqlVal(norm(r, c), c[1])).join(", ")})`).join(",\n") + ";");
}
sql.push("", "commit;", "");
writeFileSync(join(OUT, "seed.sql"), sql.join("\n"));
writeFileSync(join(OUT, "data", "axon_seed.json"), JSON.stringify(json, null, 2) + "\n");

const counts = TABLES.map(([t, , r]) => `${t}=${r.length}`).join(" ");
const open = db.flags.filter((f) => f.status === "open");
console.log(counts);
console.log(`open flags: ${open.length}`);
for (const f of db.flags) console.log(`  ${f.status.padEnd(8)} ${f.id}`);
