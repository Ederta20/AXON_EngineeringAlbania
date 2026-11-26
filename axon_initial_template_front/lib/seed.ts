// Seed data. Everything here comes from the fictional Student Starter Pack.
// Rows marked simulated: true are fictional additions so the score is demoable;
// the UI labels them "simulated". App clock is fixed at 14 Oct 2026.
import type {
  Db, User, Case, Scope, AccessItem, Evidence, Validation, WeightProfile, OneOnOne, Checkin,
  ScoreSnapshot, StageHistory, DocReference, Skill, Challenge, ChallengeResult, Benchmark,
  PathSuggestion, Project, Path, Action, Stage,
} from "./types";

export const TODAY = "2026-10-14";

const users: User[] = [
  { id: "u-pmo", name: "Sam Ortiz", email: "sam.ortiz@example.test", role: "pmo", title: "PMO Coordinator" },
  { id: "u-hr", name: "Hana Brooks", email: "hana.brooks@example.test", role: "hr", title: "HR Partner" },
  { id: "u-mgmt", name: "Erin Shaw", email: "erin.shaw@example.test", role: "mgmt", title: "Delivery Director" },
  { id: "u-cm", name: "Marco Fenn", email: "marco.fenn@example.test", role: "core_manager", title: "Core Manager, Orion and Vega" },
  { id: "u-admin", name: "Tess Albright", email: "tess.albright@example.test", role: "admin", title: "Platform Admin" },
  // Technical Leads (fictional, one per project; Helios has none on purpose)
  { id: "u-tl-aurora", name: "Kai Brennan", email: "kai.brennan@example.test", role: "tl", title: "Tech Lead, Aurora", project_id: "p-aurora" },
  { id: "u-tl-nimbus", name: "Petra Lind", email: "petra.lind@example.test", role: "tl", title: "Tech Lead, Nimbus", project_id: "p-nimbus" },
  { id: "u-tl-orion", name: "Ada Quinn", email: "ada.quinn@example.test", role: "tl", title: "Tech Lead, Orion", project_id: "p-orion" },
  { id: "u-tl-atlas", name: "Ben Royce", email: "ben.royce@example.test", role: "tl", title: "Tech Lead and KT owner, Atlas", project_id: "p-atlas" },
  { id: "u-tl-nova", name: "Cleo Marsh", email: "cleo.marsh@example.test", role: "tl", title: "Tech Lead, Nova", project_id: "p-nova" },
  { id: "u-tl-pulse", name: "Ivo Sand", email: "ivo.sand@example.test", role: "tl", title: "Tech Lead, Pulse", project_id: "p-pulse" },
  { id: "u-tl-vega", name: "Rhea Vance", email: "rhea.vance@example.test", role: "tl", title: "Tech Lead, Vega", project_id: "p-vega" },
  { id: "u-tm", name: "Dario Wells", email: "dario.wells@example.test", role: "tl", title: "Technical Manager" },
  // Line Managers (from the pack)
  { id: "u-lm-jon", name: "Jon Vale", email: "jon.vale@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-sara", name: "Sara Neri", email: "sara.neri@example.test", role: "lm", title: "Project Manager, Nimbus" },
  { id: "u-lm-tomas", name: "Tomas Reed", email: "tomas.reed@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-luca", name: "Luca Gray", email: "luca.gray@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-maya", name: "Maya Ford", email: "maya.ford@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-rita", name: "Rita Cole", email: "rita.cole@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-mark", name: "Mark Hale", email: "mark.hale@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-nina", name: "Nina Cross", email: "nina.cross@example.test", role: "lm", title: "Line Manager" },
  { id: "u-lm-alex", name: "Alex North", email: "alex.north@example.test", role: "lm", title: "Line Manager" },
  // Employees
  { id: "u-e-001", name: "Mila Rowan", email: "mila.rowan@example.test", role: "employee", title: "Support Analyst", case_id: "ONB-001" },
  { id: "u-e-002", name: "Leo Marin", email: "leo.marin@example.test", role: "employee", title: "Integration Developer", case_id: "ONB-002" },
  { id: "u-e-003", name: "Nora Venn", email: "nora.venn@example.test", role: "employee", title: "Role not confirmed", case_id: "ONB-003" },
  { id: "u-e-004", name: "Aron Bell", email: "aron.bell@example.test", role: "employee", title: "QA Engineer", case_id: "ONB-004" },
  { id: "u-e-005", name: "Eva Stone", email: "eva.stone@example.test", role: "employee", title: "Service Desk Analyst", case_id: "ONB-005" },
  { id: "u-e-006", name: "Noah Lane", email: "noah.lane@example.test", role: "employee", title: "Operations Analyst", case_id: "ONB-006" },
  { id: "u-e-007", name: "Iris Moon", email: "iris.moon@example.test", role: "employee", title: "Network Engineer", case_id: "ONB-007" },
  { id: "u-e-008", name: "Theo Park", email: "theo.park@example.test", role: "employee", title: "Data Analyst", case_id: "ONB-008" },
  { id: "u-e-009", name: "Lina West", email: "lina.west@example.test", role: "employee", title: "Role not confirmed", case_id: "ONB-009" },
  { id: "u-e-010", name: "Owen Hart", email: "owen.hart@example.test", role: "employee", title: "Application Support Engineer", case_id: "ONB-010" },
];

const projects: Project[] = [
  { id: "p-aurora", name: "Aurora", code: "AUR-114", client_id: "c-halden" },
  { id: "p-nimbus", name: "Nimbus", code: "NIM-482", client_id: "c-halden" },
  { id: "p-helios", name: "Helios", code: "HEL-207", client_id: null },
  { id: "p-orion", name: "Orion", code: "ORI-330", client_id: "c-meridian" },
  { id: "p-atlas", name: "Atlas", code: "ATL-512", client_id: null },
  { id: "p-nova", name: "Nova", code: "NOV-161", client_id: null },
  { id: "p-pulse", name: "Pulse", code: "PUL-275", client_id: "c-halden" },
  { id: "p-vega", name: "Vega", code: "VEG-390", client_id: "c-meridian" },
];

const paths: Path[] = [
  { id: "pa-aurora", project_id: "p-aurora", role_name: "Support Analyst" },
  { id: "pa-nimbus", project_id: "p-nimbus", role_name: "Integration Developer" },
  { id: "pa-helios", project_id: "p-helios", role_name: "QA Engineer" },
  { id: "pa-orion", project_id: "p-orion", role_name: "Service Desk Analyst" },
  { id: "pa-atlas", project_id: "p-atlas", role_name: "Operations Analyst" },
  { id: "pa-nova", project_id: "p-nova", role_name: "Network Engineer" },
  { id: "pa-pulse", project_id: "p-pulse", role_name: "Data Analyst" },
  { id: "pa-vega", project_id: "p-vega", role_name: "Application Support Engineer" },
];

const c = (x: Partial<Case> & Pick<Case, "id" | "employee_id">): Case => ({
  movement_type: "new_hire", project_id: null, role: null, path_id: null, line_manager_id: null, tl_id: null,
  start_date: TODAY, expected_ready_date: null, stage: "in_kt", outcome: null, tracker_status: "", tracker_updated_at: TODAY,
  profile_id: "wp-default", seniority: "mid", ...x,
});

const cases: Case[] = [
  c({ id: "ONB-001", employee_id: "u-e-001", movement_type: "new_hire", project_id: "p-aurora", role: "Support Analyst", path_id: "pa-aurora", line_manager_id: "u-lm-jon", tl_id: "u-tl-aurora", start_date: "2026-10-05", expected_ready_date: null, stage: "in_kt", tracker_status: "Shadowing", tracker_updated_at: "2026-10-13", profile_id: "wp-newhire", seniority: "junior" }),
  c({ id: "ONB-002", employee_id: "u-e-002", movement_type: "reallocation", project_id: "p-nimbus", role: "Integration Developer", path_id: "pa-nimbus", line_manager_id: "u-lm-sara", tl_id: "u-tl-nimbus", start_date: "2026-10-07", expected_ready_date: "2026-11-06", stage: "setup", tracker_status: "Access Pending", tracker_updated_at: "2026-10-14", profile_id: "wp-transfer" }),
  c({ id: "ONB-003", employee_id: "u-e-003", movement_type: "new_hire", project_id: null, role: null, path_id: null, line_manager_id: "u-lm-tomas", tl_id: null, start_date: "2026-09-28", expected_ready_date: null, stage: "pre_onboarding", tracker_status: "On Track", tracker_updated_at: "2026-09-30", profile_id: "wp-newhire", seniority: "junior" }),
  c({ id: "ONB-004", employee_id: "u-e-004", movement_type: "reallocation", project_id: "p-helios", role: "QA Engineer", path_id: "pa-helios", line_manager_id: null, tl_id: null, start_date: "2026-10-01", expected_ready_date: "2026-11-12", stage: "in_kt", tracker_status: "KT Started", tracker_updated_at: "2026-10-11", profile_id: "wp-transfer" }),
  c({ id: "ONB-005", employee_id: "u-e-005", movement_type: "new_hire", project_id: "p-orion", role: "Service Desk Analyst", path_id: "pa-orion", line_manager_id: "u-lm-luca", tl_id: "u-tl-orion", start_date: "2026-09-21", expected_ready_date: "2026-10-30", stage: "awaiting_validation", tracker_status: "Ready with Support", tracker_updated_at: "2026-10-13", profile_id: "wp-default" }),
  c({ id: "ONB-006", employee_id: "u-e-006", movement_type: "new_hire", project_id: "p-atlas", role: "Operations Analyst", path_id: "pa-atlas", line_manager_id: "u-lm-maya", tl_id: "u-tl-atlas", start_date: "2026-10-12", expected_ready_date: "2026-11-20", stage: "pre_onboarding", tracker_status: "Pre-Onboarding", tracker_updated_at: "2026-10-12", profile_id: "wp-newhire", seniority: "junior" }),
  c({ id: "ONB-007", employee_id: "u-e-007", movement_type: "reallocation", project_id: "p-nova", role: "Network Engineer", path_id: "pa-nova", line_manager_id: "u-lm-rita", tl_id: "u-tl-nova", start_date: "2026-09-15", expected_ready_date: "2026-10-24", stage: "in_kt", tracker_status: "On Track", tracker_updated_at: "2026-09-20", profile_id: "wp-transfer" }),
  c({ id: "ONB-008", employee_id: "u-e-008", movement_type: "new_hire", project_id: "p-pulse", role: "Data Analyst", path_id: "pa-pulse", line_manager_id: "u-lm-mark", tl_id: "u-tl-pulse", start_date: "2026-10-03", expected_ready_date: "2026-11-13", stage: "in_kt", tracker_status: "Blocked", tracker_updated_at: "2026-10-14", profile_id: "wp-newhire", seniority: "junior" }),
  c({ id: "ONB-009", employee_id: "u-e-009", movement_type: "reallocation", project_id: null, role: null, path_id: null, line_manager_id: "u-lm-nina", tl_id: null, start_date: "2026-10-06", expected_ready_date: null, stage: "in_kt", tracker_status: "KT Started", tracker_updated_at: "2026-10-09", profile_id: "wp-transfer" }),
  c({ id: "ONB-010", employee_id: "u-e-010", movement_type: "new_hire", project_id: "p-vega", role: "Application Support Engineer", path_id: "pa-vega", line_manager_id: "u-lm-alex", tl_id: "u-tl-vega", start_date: "2026-09-29", expected_ready_date: null, stage: "in_kt", tracker_status: "Partially Ready", tracker_updated_at: "2026-10-14", profile_id: "wp-newhire", seniority: "junior" }),
];

const s = (id: string, case_id: string, name: string, level: Scope["level"], is_core = true, at = "2026-10-10"): Scope =>
  ({ id, case_id, name, is_core, level, level_updated_at: at });

const scopes: Scope[] = [
  s("s-001-1", "ONB-001", "Aurora ticket handling", "shadowing", true, "2026-10-08"),
  s("s-001-2", "ONB-001", "Knowledge base upkeep", "shadowing", true, "2026-10-12"),
  s("s-002-1", "ONB-002", "Nimbus integration flows", "not_started", true, "2026-10-07"),
  s("s-002-2", "ONB-002", "Release process", "not_started", true, "2026-10-07"),
  s("s-004-1", "ONB-004", "Helios regression suite", "supported", true, "2026-10-10"),
  s("s-004-2", "ONB-004", "Test automation framework", "shadowing", true, "2026-10-08"),
  s("s-005-1", "ONB-005", "Standard service requests", "independent", true, "2026-10-09"),
  s("s-005-2", "ONB-005", "Incident triage", "independent", true, "2026-10-08"),
  s("s-005-3", "ONB-005", "Complex scenario: multi-system outage", "supported", true, "2026-10-10"),
  s("s-005-4", "ONB-005", "Complex scenario: bulk data correction", "shadowing", true, "2026-10-11"),
  s("s-005-5", "ONB-005", "Reporting and shift handover", "independent", false, "2026-10-12"),
  s("s-006-1", "ONB-006", "Atlas daily operations", "not_started", true, "2026-10-12"),
  s("s-006-2", "ONB-006", "Runbook procedures", "not_started", true, "2026-10-12"),
  s("s-007-1", "ONB-007", "Network monitoring", "shadowing", true, "2026-09-18"),
  s("s-007-2", "ONB-007", "Change requests", "not_started", true, "2026-09-15"),
  s("s-008-1", "ONB-008", "Pulse data pipelines", "supported", true, "2026-10-10"),
  s("s-008-2", "ONB-008", "Reporting dashboards", "supported", true, "2026-10-08"),
  s("s-009-1", "ONB-009", "Onboarding basics", "shadowing", false, "2026-10-09"),
  s("s-010-1", "ONB-010", "Daily standard activities", "independent", true, "2026-10-13"),
  s("s-010-2", "ONB-010", "Exception handling", "supported", true, "2026-10-13"),
  s("s-010-3", "ONB-010", "Production changes", "supported", true, "2026-10-09"),
];

const a = (x: Partial<AccessItem> & Pick<AccessItem, "id" | "case_id" | "system" | "state" | "requested_at">): AccessItem =>
  ({ owner_label: "Access Support", updated_at: x.requested_at, next_followup_at: null, note: null, proposed_state: null, ...x });

const access_items: AccessItem[] = [
  a({ id: "ac-002-1", case_id: "ONB-002", system: "Nova VPN", state: "approved", requested_at: "2026-10-07", updated_at: "2026-10-14", owner_label: "Access Support", note: "Active per Access Support on 14 Oct. Leo has not confirmed it works yet.", next_followup_at: "2026-10-15" }),
  a({ id: "ac-002-2", case_id: "ONB-002", system: "Orion Portal", state: "requested", requested_at: "2026-10-07", updated_at: "2026-10-14", owner_label: "Orion Portal application owner", note: "Awaiting application-owner approval", next_followup_at: "2026-10-15" }),
  a({ id: "ac-002-3", case_id: "ONB-002", system: "Helix Service Desk", state: "requested", requested_at: "2026-10-07", updated_at: "2026-10-14", owner_label: "Unassigned", note: "Not provisioned. No owner recorded.", next_followup_at: null }),
  a({ id: "ac-003-1", case_id: "ONB-003", system: "Email and Teams", state: "usable", requested_at: "2026-09-24", updated_at: "2026-09-28" }),
  a({ id: "ac-004-1", case_id: "ONB-004", system: "Helios Test Lab", state: "usable", requested_at: "2026-09-28", updated_at: "2026-10-01" }),
  a({ id: "ac-004-2", case_id: "ONB-004", system: "Jira (Helios)", state: "usable", requested_at: "2026-09-28", updated_at: "2026-10-01" }),
  a({ id: "ac-005-1", case_id: "ONB-005", system: "Orion Portal", state: "usable", requested_at: "2026-09-15", updated_at: "2026-09-22" }),
  a({ id: "ac-005-2", case_id: "ONB-005", system: "Helix Service Desk", state: "usable", requested_at: "2026-09-15", updated_at: "2026-09-23" }),
  a({ id: "ac-005-3", case_id: "ONB-005", system: "Nova VPN", state: "usable", requested_at: "2026-09-15", updated_at: "2026-09-21" }),
  a({ id: "ac-006-1", case_id: "ONB-006", system: "Atlas Ops Console", state: "requested", requested_at: "2026-10-10", updated_at: "2026-10-10", next_followup_at: "2026-10-15" }),
  a({ id: "ac-006-2", case_id: "ONB-006", system: "Email and Teams", state: "usable", requested_at: "2026-10-08", updated_at: "2026-10-12" }),
  a({ id: "ac-007-1", case_id: "ONB-007", system: "Nova NOC dashboard", state: "requested", requested_at: "2026-09-20", updated_at: "2026-09-20", owner_label: "Nova network team", note: "Tracker: access expected next week (20 Sep). Never confirmed." }),
  a({ id: "ac-008-1", case_id: "ONB-008", system: "Pulse data warehouse", state: "usable", requested_at: "2026-09-29", updated_at: "2026-10-03" }),
  a({ id: "ac-008-2", case_id: "ONB-008", system: "BI workspace", state: "usable", requested_at: "2026-09-29", updated_at: "2026-10-03" }),
  a({ id: "ac-009-1", case_id: "ONB-009", system: "Email and Teams", state: "usable", requested_at: "2026-10-02", updated_at: "2026-10-06" }),
  a({ id: "ac-010-1", case_id: "ONB-010", system: "Vega console", state: "usable", requested_at: "2026-09-24", updated_at: "2026-09-29" }),
  a({ id: "ac-010-2", case_id: "ONB-010", system: "ServiceNow (Vega)", state: "usable", requested_at: "2026-09-24", updated_at: "2026-09-29" }),
  a({ id: "ac-010-3", case_id: "ONB-010", system: "Nova VPN", state: "usable", requested_at: "2026-09-24", updated_at: "2026-09-29" }),
];

const ev = (x: Partial<Evidence> & Pick<Evidence, "id" | "case_id" | "kind" | "author_label" | "occurred_at" | "summary" | "source_ref">): Evidence => ({
  scope_id: null, author_role: "pmo", author_id: null, claimed_status: null, support_level: null, reworked: false,
  value_0_100: null, disputed: false, extracted_by: "ai", status: "ok", ...x,
});

const LV = { independent: 100, supported: 60, shadowing: 20 } as const;
const task = (id: string, case_id: string, scope_id: string, occurred_at: string, lvl: keyof typeof LV, summary: string, author_label: string, author_id: string, reworked = false): Evidence =>
  ev({ id, case_id, scope_id, kind: "task", author_role: "tl", author_label, author_id, occurred_at, summary, support_level: lvl,
    value_0_100: Math.max(0, LV[lvl] - (reworked ? 20 : 0)), reworked, source_ref: `tasklog://${case_id}/${id}`, extracted_by: "manual", simulated: true });

const evidence: Evidence[] = [
  // Starter pack: emails and updates (structured by A1, references only)
  ev({ id: "ev-email-1", case_id: "ONB-002", kind: "email", author_role: "lm", author_label: "Sara Neri (Project Manager)", author_id: "u-lm-sara", occurred_at: "2026-10-07",
    summary: "Requested Nova VPN, Orion Portal and Helix Service Desk accounts before project start. Project code NIM-482.", source_ref: "outlook://NIM-482/thread/access-request#msg-1" }),
  ev({ id: "ev-email-2", case_id: "ONB-002", kind: "email", author_role: "access_support", author_label: "Access Support", occurred_at: "2026-10-14",
    summary: "Nova VPN active. Orion Portal awaiting application-owner approval. Helix Service Desk not provisioned.", source_ref: "outlook://NIM-482/thread/access-request#msg-2" }),
  ev({ id: "ev-email-3", case_id: "ONB-005", kind: "tl_review", author_role: "tl", author_label: "Ada Quinn (Tech Lead)", author_id: "u-tl-orion", occurred_at: "2026-10-13",
    summary: "Completed first training topics. Handles standard requests with occasional support. Two complex scenarios still to cover.", claimed_status: "ready_with_support", value_0_100: 75, disputed: true, source_ref: "outlook://ORI-330/thread/kt-weekly#2026-10-13" }),
  ev({ id: "ev-email-4", case_id: "ONB-005", kind: "email", author_role: "lm", author_label: "Luca Gray (Line Manager)", author_id: "u-lm-luca", occurred_at: "2026-10-13",
    summary: "From the local side everything looks complete and Eva works independently. Considers onboarding closed.", claimed_status: "closed", disputed: true, source_ref: "outlook://ORI-330/thread/lm-progress#2026-10-13" }),
  ev({ id: "ev-email-5", case_id: "ONB-009", kind: "email", author_role: "pmo", author_label: "Sam Ortiz (PMO)", author_id: "u-pmo", occurred_at: "2026-10-08",
    summary: "Asked the Technical Manager to confirm Lina's exact role, KT owner and expected readiness date. No reply recorded.", source_ref: "outlook://ONB-009/thread/role-confirmation#msg-1" }),
  ev({ id: "ev-update-6", case_id: "ONB-010", kind: "checkin", author_role: "employee", author_label: "Owen Hart (self)", author_id: "u-e-010", occurred_at: "2026-10-14",
    summary: "Does daily standard activities alone. Still needs help with exceptions and production changes. All tools available. No date yet for the final readiness review.", claimed_status: "partially_ready", source_ref: "teams://axon-bot/checkin/ONB-010/2026-10-14" }),
  ev({ id: "ev-update-7", case_id: "ONB-007", kind: "tracker", author_role: "pmo", author_label: "Onboarding tracker", occurred_at: "2026-09-20",
    summary: "Shadowing started; access expected next week. Status On Track.", claimed_status: "on_track", source_ref: "tracker://onboarding.xlsx/row/ONB-007" }),
  ev({ id: "ev-email-8", case_id: "ONB-006", kind: "email", author_role: "kt_owner", author_label: "Ben Royce (KT owner)", author_id: "u-tl-atlas", occurred_at: "2026-10-11",
    summary: "Training guide and runbook are in /Team/Operations/Onboarding. Project-owned; keep only the folder reference.", source_ref: "outlook://ATL-512/thread/docs-location#msg-1" }),
  // Tracker rows
  ev({ id: "ev-tr-001", case_id: "ONB-001", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-13", summary: "Status Shadowing.", claimed_status: "shadowing", source_ref: "tracker://onboarding.xlsx/row/ONB-001", extracted_by: "manual" }),
  ev({ id: "ev-tr-003", case_id: "ONB-003", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-09-30", summary: "Status On Track. Project column empty.", claimed_status: "on_track", source_ref: "tracker://onboarding.xlsx/row/ONB-003", extracted_by: "manual" }),
  ev({ id: "ev-tr-004", case_id: "ONB-004", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-11", summary: "Status KT Started. Manager column empty.", claimed_status: "kt_started", source_ref: "tracker://onboarding.xlsx/row/ONB-004", extracted_by: "manual" }),
  ev({ id: "ev-tr-006", case_id: "ONB-006", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-12", summary: "Status Pre-Onboarding.", claimed_status: "pre_onboarding", source_ref: "tracker://onboarding.xlsx/row/ONB-006", extracted_by: "manual" }),
  ev({ id: "ev-tr-008", case_id: "ONB-008", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-14", summary: "Status Blocked. No reason or owner given.", claimed_status: "blocked", source_ref: "tracker://onboarding.xlsx/row/ONB-008", extracted_by: "manual" }),
  ev({ id: "ev-tr-009", case_id: "ONB-009", kind: "tracker", author_label: "Onboarding tracker", occurred_at: "2026-10-09", summary: "Status KT Started. Project column empty.", claimed_status: "kt_started", source_ref: "tracker://onboarding.xlsx/row/ONB-009", extracted_by: "manual" }),
  // Simulated task evidence
  task("ev-t-005-1", "ONB-005", "s-005-1", "2026-09-29", "supported", "Resolved 6 standard requests with a reviewer", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-2", "ONB-005", "s-005-1", "2026-10-02", "independent", "Resolved 9 standard requests alone, no rework", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-3", "ONB-005", "s-005-2", "2026-10-06", "supported", "Triaged 4 incidents with guidance", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-4", "ONB-005", "s-005-2", "2026-10-08", "independent", "Triaged 5 incidents alone; escalated 1 correctly", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-5", "ONB-005", "s-005-1", "2026-10-09", "independent", "Resolved 11 standard requests alone", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-6", "ONB-005", "s-005-3", "2026-10-10", "supported", "Joined outage drill; ran steps 1-4 with TL guiding", "Ada Quinn", "u-tl-orion"),
  task("ev-t-005-7", "ONB-005", "s-005-5", "2026-10-12", "independent", "Wrote shift handover notes alone for 3 shifts", "Ada Quinn", "u-tl-orion"),
  task("ev-t-001-1", "ONB-001", "s-001-1", "2026-10-08", "shadowing", "Observed ticket handling session", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-001-2", "ONB-001", "s-001-2", "2026-10-12", "shadowing", "Observed knowledge base update", "Kai Brennan", "u-tl-aurora"),
  task("ev-t-004-1", "ONB-004", "s-004-2", "2026-10-08", "shadowing", "Observed automation framework walkthrough", "Helios QA team", "u-pmo"),
  task("ev-t-004-2", "ONB-004", "s-004-1", "2026-10-10", "supported", "Ran regression suite with reviewer", "Helios QA team", "u-pmo"),
  task("ev-t-007-1", "ONB-007", "s-007-1", "2026-09-18", "shadowing", "Observed monitoring shift", "Cleo Marsh", "u-tl-nova"),
  task("ev-t-008-1", "ONB-008", "s-008-1", "2026-10-08", "supported", "Fixed a pipeline job with guidance", "Ivo Sand", "u-tl-pulse"),
  task("ev-t-008-2", "ONB-008", "s-008-2", "2026-10-10", "supported", "Built a dashboard tile under review", "Ivo Sand", "u-tl-pulse", true),
  task("ev-t-009-1", "ONB-009", "s-009-1", "2026-10-09", "shadowing", "Observed team standup and ticket flow", "Nina Cross", "u-lm-nina"),
  task("ev-t-010-1", "ONB-010", "s-010-1", "2026-10-06", "independent", "Ran daily checks alone for a week", "Rhea Vance", "u-tl-vega"),
  task("ev-t-010-2", "ONB-010", "s-010-2", "2026-10-09", "supported", "Handled 2 exceptions with support", "Rhea Vance", "u-tl-vega"),
  task("ev-t-010-3", "ONB-010", "s-010-3", "2026-10-13", "supported", "Prepared a production change with TL review", "Rhea Vance", "u-tl-vega"),
];

const weight_profiles: WeightProfile[] = [
  { id: "wp-default", name: "Default", w_work: 35, w_tl: 30, w_1on1_human: 10, w_1on1_ai: 5, w_challenge: 15, w_self: 5, version: 1, active: true },
  { id: "wp-transfer", name: "Transferee, similar skills", w_work: 40, w_tl: 30, w_1on1_human: 10, w_1on1_ai: 5, w_challenge: 10, w_self: 5, version: 1, active: true },
  { id: "wp-newhire", name: "New hire, junior", w_work: 30, w_tl: 30, w_1on1_human: 13, w_1on1_ai: 7, w_challenge: 15, w_self: 5, version: 1, active: true },
  { id: "wp-upskill", name: "Upskill, same project", w_work: 40, w_tl: 35, w_1on1_human: 7, w_1on1_ai: 3, w_challenge: 10, w_self: 5, version: 1, active: true },
];

const one_on_ones: OneOnOne[] = [
  { id: "oo-005-1", case_id: "ONB-005", rater_id: "u-tl-orion", rating_human: 8, rating_ai: 8, note: "Clear on the standard flow. Asked good questions on escalation. Less sure on outage steps.", held_at: "2026-10-09" },
  { id: "oo-008-1", case_id: "ONB-008", rater_id: "u-lm-mark", rating_human: 5, rating_ai: 6, note: "Progressing on pipelines. Mentioned waiting on something but no detail.", held_at: "2026-10-10" },
  { id: "oo-010-1", case_id: "ONB-010", rater_id: "u-lm-alex", rating_human: 6, rating_ai: 7, note: "Confident on routine work. Wants more practice on exceptions.", held_at: "2026-10-08" },
  { id: "oo-004-1", case_id: "ONB-004", rater_id: "u-pmo", rating_human: 6, rating_ai: 6, note: "Settling in on Helios. No manager to raise questions with yet.", held_at: "2026-10-09" },
];

const checkins: Checkin[] = [
  { id: "ci-005-1", case_id: "ONB-005", scope_id: null, self_score: 9, kt_rating: 4, doc_rating: 4, note: "Comfortable on standard work.", at: "2026-10-12" },
  { id: "ci-010-1", case_id: "ONB-010", scope_id: null, self_score: 7, kt_rating: 4, doc_rating: 3, note: "Need help on exceptions and production changes.", at: "2026-10-14" },
  { id: "ci-001-1", case_id: "ONB-001", scope_id: null, self_score: 4, kt_rating: 4, doc_rating: 3, note: "Still shadowing.", at: "2026-10-12" },
  { id: "ci-002-1", case_id: "ONB-002", scope_id: null, self_score: 3, kt_rating: null, doc_rating: null, note: "Cannot start without Orion Portal and Helix.", at: "2026-10-13" },
  { id: "ci-009-1", case_id: "ONB-009", scope_id: null, self_score: 5, kt_rating: 3, doc_rating: 2, note: "Not sure which project I am on.", at: "2026-10-10" },
  { id: "ci-008-1", case_id: "ONB-008", scope_id: null, self_score: 5, kt_rating: 3, doc_rating: 3, note: "", at: "2026-10-11" },
];

// A3 proposals (AI) waiting for TL sign-off. decided_level stays empty.
const vp = (id: string, case_id: string, scope_id: string, tl_id: string, proposed_level: Validation["proposed_level"], confidence: number, rationale: string, evidence_ids: string[]): Validation =>
  ({ id, case_id, scope_id, tl_id, proposed_level, proposed_by: "ai", evidence_ids, confidence, rationale, decided_level: null, reason: null, decided_at: null, decided_by: null });

const validations: Validation[] = [
  vp("va-005-1", "ONB-005", "s-005-1", "u-tl-orion", "independent", 0.88, "Two runs alone with no rework since 2 Oct, after one supported run.", ["ev-t-005-1", "ev-t-005-2", "ev-t-005-5"]),
  vp("va-005-2", "ONB-005", "s-005-2", "u-tl-orion", "independent", 0.76, "One run alone with a correct escalation after one supported run.", ["ev-t-005-3", "ev-t-005-4"]),
  vp("va-005-3", "ONB-005", "s-005-3", "u-tl-orion", "supported", 0.71, "Ran the outage drill with guidance. The TL review says this scenario is not covered yet.", ["ev-t-005-6", "ev-email-3"]),
  vp("va-005-4", "ONB-005", "s-005-4", "u-tl-orion", "shadowing", 0.64, "No task evidence. The TL review says this scenario is still to cover.", ["ev-email-3"]),
  vp("va-005-5", "ONB-005", "s-005-5", "u-tl-orion", "independent", 0.8, "Handover notes written alone for 3 shifts.", ["ev-t-005-7"]),
  vp("va-010-1", "ONB-010", "s-010-1", "u-tl-vega", "independent", 0.74, "A week of daily checks alone; self-report agrees.", ["ev-t-010-1", "ev-update-6"]),
  vp("va-010-2", "ONB-010", "s-010-2", "u-tl-vega", "supported", 0.7, "Exceptions handled with support; self-report says help still needed.", ["ev-t-010-2", "ev-update-6"]),
  vp("va-010-3", "ONB-010", "s-010-3", "u-tl-vega", "supported", 0.69, "Production change prepared under TL review.", ["ev-t-010-3", "ev-update-6"]),
  vp("va-008-1", "ONB-008", "s-008-1", "u-tl-pulse", "supported", 0.62, "Pipeline fix done with guidance; one dashboard reworked.", ["ev-t-008-1", "ev-t-008-2"]),
];

const actions: Action[] = [
  { id: "act-009-1", case_id: "ONB-009", flag_id: "fl-unanswered-ONB-009", channel: "outlook", recipient: "Dario Wells", recipient_role: "Technical Manager",
    subject: "Lina West: role, KT owner and readiness date", body: "Hi Dario, could you confirm Lina West's exact project role, her KT owner and the expected readiness date?",
    due_at: "2026-10-11", status: "sent", approved_by: "u-pmo", thread_ref: "outlook://ONB-009/thread/role-confirmation", evidence_ids: ["ev-email-5"], created_at: "2026-10-08", sent_at: "2026-10-08" },
];

// Simulated history so the trend charts have a past. Labeled simulated in the UI.
const snap = (case_id: string, pts: [string, number, number][]): ScoreSnapshot[] =>
  pts.map(([d, sc, comp]) => ({ case_id, score: sc, completeness: comp, capped: false, computed_at: d, simulated: true,
    band: sc >= 85 ? "ready" : sc >= 65 ? "ready_with_support" : sc >= 40 ? "partially_ready" : "not_ready" }));

const score_snapshots: ScoreSnapshot[] = [
  ...snap("ONB-005", [["2026-09-25", 30, 25], ["2026-09-29", 44, 40], ["2026-10-02", 58, 55], ["2026-10-06", 66, 70], ["2026-10-09", 74, 85], ["2026-10-12", 79, 100]]),
  ...snap("ONB-010", [["2026-10-02", 38, 30], ["2026-10-06", 52, 45], ["2026-10-09", 58, 65], ["2026-10-13", 61, 80]]),
  ...snap("ONB-008", [["2026-10-06", 30, 20], ["2026-10-08", 45, 35], ["2026-10-11", 52, 55]]),
  ...snap("ONB-001", [["2026-10-08", 20, 30], ["2026-10-12", 22, 40]]),
  ...snap("ONB-004", [["2026-10-08", 20, 35], ["2026-10-10", 36, 55]]),
];

const sh = (case_id: string, items: [Stage, string][]): StageHistory[] => items.map(([stage, entered_at]) => ({ case_id, stage, entered_at }));
const stage_history: StageHistory[] = [
  ...sh("ONB-001", [["pre_onboarding", "2026-09-30"], ["setup", "2026-10-05"], ["in_kt", "2026-10-08"]]),
  ...sh("ONB-002", [["pre_onboarding", "2026-10-03"], ["setup", "2026-10-07"]]),
  ...sh("ONB-003", [["pre_onboarding", "2026-09-24"]]),
  ...sh("ONB-004", [["pre_onboarding", "2026-09-28"], ["setup", "2026-10-01"], ["in_kt", "2026-10-06"]]),
  ...sh("ONB-005", [["pre_onboarding", "2026-09-16"], ["setup", "2026-09-21"], ["in_kt", "2026-09-24"], ["awaiting_validation", "2026-10-13"]]),
  ...sh("ONB-006", [["pre_onboarding", "2026-10-06"]]),
  ...sh("ONB-007", [["pre_onboarding", "2026-09-10"], ["setup", "2026-09-15"], ["in_kt", "2026-09-18"]]),
  ...sh("ONB-008", [["pre_onboarding", "2026-09-29"], ["setup", "2026-10-03"], ["in_kt", "2026-10-07"]]),
  ...sh("ONB-009", [["pre_onboarding", "2026-10-02"], ["setup", "2026-10-06"], ["in_kt", "2026-10-09"]]),
  ...sh("ONB-010", [["pre_onboarding", "2026-09-24"], ["setup", "2026-09-29"], ["in_kt", "2026-10-02"]]),
];

const doc_references: DocReference[] = [
  { id: "doc-atlas-1", project_id: "p-atlas", path_id: "pa-atlas", title: "Atlas training guide", folder_ref: "/Team/Operations/Onboarding", owner_label: "Ben Royce (KT owner)", verified_at: "2026-10-11", url: null },
  { id: "doc-atlas-2", project_id: "p-atlas", path_id: "pa-atlas", title: "Atlas runbook", folder_ref: "/Team/Operations/Onboarding", owner_label: "Ben Royce (KT owner)", verified_at: "2026-10-11", url: "/docs/atlas-runbook.html" },
  { id: "doc-orion-1", project_id: "p-orion", path_id: "pa-orion", title: "Orion service desk playbook", folder_ref: "/Orion/ServiceDesk/KT", owner_label: "Ada Quinn", verified_at: "2026-09-20", url: "/docs/orion-service-desk-playbook.html" },
  { id: "doc-orion-2", project_id: "p-orion", path_id: "pa-orion", title: "Major incident procedure", folder_ref: "/Orion/ServiceDesk/Incidents", owner_label: "Ada Quinn", verified_at: null, url: "/docs/major-incident-procedure.html" },
  { id: "doc-vega-1", project_id: "p-vega", path_id: "pa-vega", title: "Vega change process", folder_ref: "/Vega/Support/Changes", owner_label: "Rhea Vance", verified_at: "2026-09-30", url: "/docs/vega-change-process.html" },
  { id: "doc-nimbus-1", project_id: "p-nimbus", path_id: "pa-nimbus", title: "Nimbus integration overview", folder_ref: "/Nimbus/Engineering/Onboarding", owner_label: "Petra Lind", verified_at: "2026-10-01", url: null },
];

const skills: Skill[] = [
  { id: "sk-orion-1", path_id: "pa-orion", name: "Standard service requests", doc_ref: "doc-orion-1", coverage: 90, last_updated: "2026-09-20" },
  { id: "sk-orion-2", path_id: "pa-orion", name: "Incident triage and escalation", doc_ref: "doc-orion-2", coverage: 70, last_updated: "2026-09-20" },
  { id: "sk-orion-3", path_id: "pa-orion", name: "Multi-system outage handling", doc_ref: "doc-orion-2", coverage: 40, last_updated: "2026-08-02" },
  { id: "sk-orion-4", path_id: "pa-orion", name: "Bulk data correction", doc_ref: null, coverage: 0, last_updated: "2026-08-02" },
  { id: "sk-atlas-1", path_id: "pa-atlas", name: "Daily operations checklist", doc_ref: "doc-atlas-2", coverage: 85, last_updated: "2026-10-11" },
  { id: "sk-atlas-2", path_id: "pa-atlas", name: "Runbook procedures", doc_ref: "doc-atlas-2", coverage: 80, last_updated: "2026-10-11" },
  { id: "sk-vega-1", path_id: "pa-vega", name: "Daily standard activities", doc_ref: "doc-vega-1", coverage: 75, last_updated: "2026-09-30" },
  { id: "sk-vega-2", path_id: "pa-vega", name: "Production changes", doc_ref: "doc-vega-1", coverage: 60, last_updated: "2026-09-30" },
  { id: "sk-vega-3", path_id: "pa-vega", name: "Exception handling", doc_ref: null, coverage: 20, last_updated: "2026-09-30" },
  { id: "sk-nimbus-1", path_id: "pa-nimbus", name: "Integration flows", doc_ref: "doc-nimbus-1", coverage: 65, last_updated: "2026-10-01" },
];

const challenges: Challenge[] = [
  { id: "ch-orion-1", skill_id: "sk-orion-1", prompt: "A user asks for access to a shared mailbox without manager approval. Walk through how you handle the request.", approved_by: "u-tl-orion", created_by: "ai" },
  { id: "ch-orion-2", skill_id: "sk-orion-2", prompt: "Three tickets report slow logins in 10 minutes. Decide priority, who you escalate to and what you write in the ticket.", approved_by: "u-tl-orion", created_by: "ai" },
  { id: "ch-orion-3", skill_id: "sk-orion-3", prompt: "Orion Portal and Helix are both down. List your first five steps and who you notify.", approved_by: null, created_by: "ai" },
  { id: "ch-vega-1", skill_id: "sk-vega-2", prompt: "A production change fails validation at step 3. What do you check, and when do you roll back?", approved_by: null, created_by: "ai" },
];

const challenge_results: ChallengeResult[] = [
  { id: "cr-005-1", case_id: "ONB-005", challenge_id: "ch-orion-1", score: 88, reviewed_by: "u-tl-orion", submitted_at: "2026-10-07" },
  { id: "cr-005-2", case_id: "ONB-005", challenge_id: "ch-orion-2", score: 86, reviewed_by: "u-tl-orion", submitted_at: "2026-10-11" },
];

const STAGES: [Stage, number][] = [["pre_onboarding", 4], ["setup", 4], ["in_kt", 19], ["awaiting_validation", 4]];
const benchmarks: Benchmark[] = paths.flatMap((p) => STAGES.map(([stage, d]) => ({
  path_id: p.id, stage, median_days: d + (p.id === "pa-orion" && stage === "in_kt" ? 2 : 0),
  n_completed: p.id === "pa-orion" ? 4 : p.id === "pa-vega" ? 3 : 1, provisional: !(p.id === "pa-orion" || p.id === "pa-vega"),
})));

const path_suggestions: PathSuggestion[] = [
  { id: "ps-1", path_id: "pa-nimbus", suggestion: "Request Helix Service Desk access during pre-onboarding, not on start day.", cause_flag_ids: ["fl-access_delay-ONB-002"], status: "proposed", approved_by: null },
  { id: "ps-2", path_id: "pa-orion", suggestion: "Add a KT topic for bulk data correction; no document covers it today.", cause_flag_ids: ["fl-conflict-ONB-005"], status: "proposed", approved_by: null },
  { id: "ps-3", path_id: "pa-vega", suggestion: "Book the final readiness review when the KT plan is approved.", cause_flag_ids: ["fl-missing_info-ONB-010"], status: "proposed", approved_by: null },
];

export function makeSeed(): Db {
  return structuredClone({
    users, projects, paths, cases, scopes, access_items, evidence, flags: [], actions, validations, weight_profiles,
    score_snapshots, one_on_ones, checkins, stage_history, doc_references, skills, challenges, challenge_results, benchmarks,
    path_suggestions, clients: [{ id: "c-meridian", name: "Meridian Bank (fictional)" }, { id: "c-halden", name: "Halden Energy (fictional)" }],
    client_requirements: [], audit_log: [],
    config: { stale_days: 10, escalate_days: 5, tl_cap: 84, provisional_below: 60, rating_gap: 2, bands: { not_ready: 0, partially_ready: 40, ready_with_support: 65, ready: 85 } },
    resolved_flag_ids: [], done_steps: [],
  } satisfies Db);
}
