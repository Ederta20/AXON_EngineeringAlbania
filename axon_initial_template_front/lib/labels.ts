import type { AccessState, Band, CauseClass, FlagType, Role, ScopeLevel, Severity, Stage, MovementType, Outcome } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  employee: "Employee", hr: "HR", lm: "Line Manager", tl: "Tech Lead", pmo: "PMO / Coordinator",
  mgmt: "Management", core_manager: "Core Manager", admin: "Admin",
};

export const ROLE_QUESTION: Record<Role, string> = {
  employee: "What do I do next, and how am I doing?",
  hr: "Did each onboarding start correctly?",
  lm: "How are my people progressing, and what blocks them?",
  tl: "Whose readiness do I need to validate?",
  pmo: "Which gaps need an owner and a follow-up today?",
  mgmt: "Where is readiness at risk, and why?",
  core_manager: "Which client requirements change onboarding?",
  admin: "Are weights, thresholds and requirement changes correct?",
};

export const STAGES: Stage[] = ["pre_onboarding", "setup", "in_kt", "awaiting_validation", "outcome", "closed"];
export const STAGE_LABEL: Record<Stage, string> = {
  pre_onboarding: "Pre-onboarding", setup: "Setup", in_kt: "In KT", awaiting_validation: "Awaiting validation", outcome: "Outcome", closed: "Closed",
};

export const OUTCOME_LABEL: Record<Outcome, string> = { ready: "Ready", ready_with_support: "Ready with Support", partially_ready: "Partially Ready" };

export const LEVELS: ScopeLevel[] = ["not_started", "shadowing", "supported", "independent", "validated"];
export const LEVEL_LABEL: Record<ScopeLevel, string> = {
  not_started: "Not started", shadowing: "Shadowing", supported: "Supported", independent: "Independent", validated: "Validated",
};
export const LEVEL_HINT: Record<ScopeLevel, string> = {
  not_started: "No KT activity yet",
  shadowing: "Observes an experienced colleague and asks questions",
  supported: "Does the work while a colleague guides or reviews",
  independent: "Does the agreed work alone and knows when to escalate",
  validated: "Confirmed by the Tech Lead",
};

export const FLAG_LABEL: Record<FlagType, string> = {
  blocked: "Blocked", stale: "Stale", conflict: "Conflict", at_risk: "At risk", unanswered: "Unanswered request",
  missing_info: "Missing info", access_delay: "Access delay", date_mismatch: "Date mismatch", client_requirement: "Client requirement", rating_gap: "Rating gap",
};

export const CAUSE_LABEL: Record<CauseClass, string> = { process: "Process", compliance: "Team compliance", external: "External", individual: "Individual" };
export const CAUSE_HINT: Record<CauseClass, string> = {
  process: "Fix the onboarding template or workflow",
  compliance: "A team skipped an agreed step",
  external: "Waiting on someone outside the team",
  individual: "Specific to this person or case",
};

export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

export const BAND_LABEL: Record<Band, string> = { not_ready: "Not ready", partially_ready: "Partially Ready", ready_with_support: "Ready with Support", ready: "Ready" };
export const BAND_RANGE: Record<Band, string> = { not_ready: "0–39", partially_ready: "40–64", ready_with_support: "65–84", ready: "85–100" };

export const ACCESS_LABEL: Record<AccessState, string> = { requested: "Requested", approved: "Approved", usable: "Usable" };
export const MOVEMENT_LABEL: Record<MovementType, string> = { new_hire: "New hire", reallocation: "Reallocation", upskill: "Upskill" };

export const EVIDENCE_KIND_LABEL: Record<string, string> = {
  email: "Email", tracker: "Tracker", tl_review: "TL review", task: "Task", checkin: "Check-in", one_on_one: "1:1", challenge: "Challenge",
};
