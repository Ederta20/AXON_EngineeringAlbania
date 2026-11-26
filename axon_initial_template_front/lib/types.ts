// AXON domain types. Mirrors the Postgres tables in the project brief (Part 3, 5, 6).
// Nullable fields are where gaps show up: the rules engine looks for them.

export type Role = "employee" | "hr" | "lm" | "tl" | "pmo" | "mgmt" | "core_manager" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  project_id?: string | null;
  case_id?: string | null; // employees only
}

export interface Project { id: string; name: string; code: string; client_id?: string | null }
export interface Path { id: string; project_id: string; role_name: string }

export type MovementType = "new_hire" | "reallocation" | "upskill";
export type Stage = "pre_onboarding" | "setup" | "in_kt" | "awaiting_validation" | "outcome" | "closed";
export type Outcome = "ready" | "ready_with_support" | "partially_ready";

export interface Case {
  id: string; // ONB-001
  employee_id: string;
  movement_type: MovementType;
  project_id: string | null;
  role: string | null;
  path_id: string | null;
  line_manager_id: string | null;
  tl_id: string | null;
  start_date: string;
  expected_ready_date: string | null;
  stage: Stage;
  outcome: Outcome | null;
  tracker_status: string;
  tracker_updated_at: string;
  profile_id: string;
  seniority?: "junior" | "mid" | "senior";
}

export type ScopeLevel = "not_started" | "shadowing" | "supported" | "independent" | "validated";

export interface Scope {
  id: string;
  case_id: string;
  name: string;
  is_core: boolean;
  level: ScopeLevel;
  level_updated_at: string;
  added_by_requirement?: string | null;
}

export type AccessState = "requested" | "approved" | "usable";

export interface AccessItem {
  id: string;
  case_id: string;
  system: string;
  state: AccessState;
  owner_label: string;
  requested_at: string;
  updated_at: string;
  next_followup_at: string | null;
  note?: string | null;
  proposed_state?: AccessState | null; // A1 proposal, waiting for a person
}

export type EvidenceKind = "email" | "tracker" | "tl_review" | "task" | "checkin" | "one_on_one" | "challenge";

export interface Evidence {
  id: string;
  case_id: string;
  scope_id: string | null;
  kind: EvidenceKind;
  author_role: Role | "access_support" | "kt_owner" | "tm";
  author_label: string;
  author_id: string | null;
  source_ref: string; // reference only, never the raw message body
  occurred_at: string;
  summary: string;
  claimed_status: string | null;
  support_level: "shadowing" | "supported" | "independent" | null;
  reworked: boolean;
  value_0_100: number | null;
  disputed: boolean;
  extracted_by: "ai" | "manual" | string;
  status: "ok" | "needs_review";
  simulated?: boolean;
}

export type FlagType =
  | "blocked" | "stale" | "conflict" | "at_risk" | "unanswered" | "missing_info"
  | "access_delay" | "date_mismatch" | "client_requirement" | "rating_gap";

export type CauseClass = "process" | "compliance" | "external" | "individual";
export type Severity = "high" | "medium" | "low";

export interface Flag {
  id: string;
  case_id: string;
  type: FlagType;
  severity: Severity;
  cause_class: CauseClass | null;
  cause_confirmed: boolean; // false = proposed by A2
  owner_id: string | null;
  owner_label: string;
  suggested_owner: string | null;
  raised_at: string;
  due_at: string;
  status: "open" | "resolved";
  evidence_ids: string[];
  detail: string;
  root_cause: string | null; // A2 sentence
  origin: "rule" | "manual";
  rule?: string; // rule_stale, rule_missing_info, ...
  resolved_at?: string | null;
  resolution?: string | null;
}

export type Channel = "teams" | "outlook";
export type ActionStatus = "draft" | "approved" | "sent" | "rejected" | "answered";

export interface Action {
  id: string;
  case_id: string;
  flag_id: string;
  channel: Channel;
  recipient: string;
  recipient_role: string;
  subject?: string;
  body: string;
  due_at: string;
  status: ActionStatus;
  approved_by: string | null;
  thread_ref: string;
  evidence_ids: string[];
  created_at: string;
  sent_at?: string | null;
  answered_at?: string | null;
  reply_summary?: string | null;
  reject_reason?: string | null;
}

export interface Validation {
  id: string;
  case_id: string;
  scope_id: string;
  tl_id: string | null;
  proposed_level: ScopeLevel;
  proposed_by: "ai";
  evidence_ids: string[];
  confidence: number;
  rationale: string;
  decided_level: ScopeLevel | null;
  reason: string | null;
  decided_at: string | null;
  decided_by: string | null;
}

export interface WeightProfile {
  id: string;
  name: string;
  w_work: number;
  w_tl: number;
  w_1on1_human: number;
  w_1on1_ai: number;
  w_challenge: number; // never above 15
  w_self: number;
  version: number;
  active: boolean;
}

export type Band = "not_ready" | "partially_ready" | "ready_with_support" | "ready";

export interface ScoreComponent {
  key: "work" | "tl" | "oneonone_human" | "oneonone_ai" | "challenge" | "self";
  label: string;
  weight: number;
  value: number | null; // 0-100, null = no data
  evidence_ids: string[];
}

export interface ScoreResult {
  case_id: string;
  score: number | null;
  raw: number | null;
  band: Band | null;
  completeness: number; // 0-100
  capped: boolean;
  tl_gate_passed: boolean;
  provisional: boolean;
  components: ScoreComponent[];
  profile_id: string;
}

export interface ScoreSnapshot { case_id: string; score: number; band: Band; completeness: number; capped: boolean; computed_at: string; simulated?: boolean }

export interface OneOnOne {
  id: string;
  case_id: string;
  rater_id: string;
  rating_human: number;
  rating_ai: number | null;
  note: string;
  held_at: string;
}

export interface Checkin {
  id: string;
  case_id: string;
  scope_id: string | null;
  self_score: number;
  kt_rating: number | null;
  doc_rating: number | null;
  note: string;
  at: string;
}

export interface StageHistory { case_id: string; stage: Stage; entered_at: string }

export interface DocReference {
  id: string;
  project_id: string;
  path_id: string | null;
  title: string;
  folder_ref: string;
  owner_label: string;
  verified_at: string | null;
}

export interface Skill { id: string; path_id: string; name: string; doc_ref: string | null; coverage: number; last_updated: string }
export interface Challenge { id: string; skill_id: string; prompt: string; approved_by: string | null; created_by: "ai" }
export interface ChallengeResult { id: string; case_id: string; challenge_id: string; score: number | null; reviewed_by: string | null; submitted_at: string }
export interface Benchmark { path_id: string; stage: Stage; median_days: number; n_completed: number; provisional: boolean }
export interface PathSuggestion { id: string; path_id: string; suggestion: string; cause_flag_ids: string[]; status: "proposed" | "approved" | "rejected"; approved_by: string | null }

export interface Client { id: string; name: string }
export type RequirementType = "skill" | "access" | "deadline" | "compliance" | "scope";
export interface ClientRequirement {
  id: string;
  client_id: string | null;
  project_id: string;
  path_id: string | null;
  type: RequirementType;
  detail: string;
  effective_date: string | null;
  affected_case_ids: string[];
  impact: string;
  status: "proposed" | "submitted" | "approved" | "rejected";
  submitted_by: string | null;
  approved_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AuditEntry { id: string; actor: string; action: string; entity: string; entity_id: string; payload?: Record<string, unknown>; at: string }

export interface Config {
  stale_days: number;
  escalate_days: number;
  tl_cap: number;
  provisional_below: number;
  rating_gap: number;
  bands: { not_ready: number; partially_ready: number; ready_with_support: number; ready: number };
}

export interface Db {
  users: User[];
  projects: Project[];
  paths: Path[];
  cases: Case[];
  scopes: Scope[];
  access_items: AccessItem[];
  evidence: Evidence[];
  flags: Flag[];
  actions: Action[];
  validations: Validation[];
  weight_profiles: WeightProfile[];
  score_snapshots: ScoreSnapshot[];
  one_on_ones: OneOnOne[];
  checkins: Checkin[];
  stage_history: StageHistory[];
  doc_references: DocReference[];
  skills: Skill[];
  challenges: Challenge[];
  challenge_results: ChallengeResult[];
  benchmarks: Benchmark[];
  path_suggestions: PathSuggestion[];
  clients: Client[];
  client_requirements: ClientRequirement[];
  audit_log: AuditEntry[];
  config: Config;
  resolved_flag_ids: string[]; // flags people closed by hand
  done_steps: string[]; // employee next-step keys marked done
}
