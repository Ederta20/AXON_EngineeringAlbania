// Table map between the in-memory Db (lib/types.ts) and the Supabase tables (supabase/migrations).
// Order matters: parents before children, so upserts satisfy foreign keys (deletes run in reverse).
import type { Db } from "../types";

export type TableKey = Exclude<keyof Db, "config" | "resolved_flag_ids" | "done_steps">;

export interface TableDef {
  table: string;                 // Supabase table name
  key: TableKey | "done_steps";  // Db field
  pk: string[];                  // primary key columns
  cols: string[];                // columns written back (anything else on the row is ignored)
}

export const TABLES: TableDef[] = [
  { table: "clients", key: "clients", pk: ["id"], cols: ["id", "name"] },
  { table: "projects", key: "projects", pk: ["id"], cols: ["id", "name", "code", "client_id"] },
  { table: "paths", key: "paths", pk: ["id"], cols: ["id", "project_id", "role_name"] },
  { table: "users", key: "users", pk: ["id"], cols: ["id", "name", "email", "role", "title", "project_id", "case_id"] },
  { table: "weight_profiles", key: "weight_profiles", pk: ["id"], cols: ["id", "name", "w_work", "w_tl", "w_1on1_human", "w_1on1_ai", "w_challenge", "w_self", "version", "active"] },
  { table: "cases", key: "cases", pk: ["id"], cols: ["id", "employee_id", "movement_type", "project_id", "role", "path_id", "line_manager_id", "tl_id", "start_date", "expected_ready_date", "stage", "outcome", "tracker_status", "tracker_updated_at", "profile_id", "seniority"] },
  { table: "client_requirements", key: "client_requirements", pk: ["id"], cols: ["id", "client_id", "project_id", "path_id", "type", "detail", "effective_date", "affected_case_ids", "impact", "status", "submitted_by", "approved_by", "reason", "created_at"] },
  { table: "scopes", key: "scopes", pk: ["id"], cols: ["id", "case_id", "name", "is_core", "level", "level_updated_at", "added_by_requirement"] },
  { table: "access_items", key: "access_items", pk: ["id"], cols: ["id", "case_id", "system", "state", "owner_label", "requested_at", "updated_at", "next_followup_at", "note", "proposed_state"] },
  { table: "evidence", key: "evidence", pk: ["id"], cols: ["id", "case_id", "scope_id", "kind", "author_role", "author_label", "author_id", "source_ref", "occurred_at", "summary", "claimed_status", "support_level", "reworked", "value_0_100", "disputed", "extracted_by", "status", "simulated"] },
  { table: "flags", key: "flags", pk: ["id"], cols: ["id", "case_id", "type", "severity", "cause_class", "cause_confirmed", "owner_id", "owner_label", "suggested_owner", "raised_at", "due_at", "status", "evidence_ids", "detail", "root_cause", "origin", "rule", "resolved_at", "resolution", "manually_resolved"] },
  { table: "actions", key: "actions", pk: ["id"], cols: ["id", "case_id", "flag_id", "channel", "recipient", "recipient_role", "subject", "body", "due_at", "status", "approved_by", "thread_ref", "evidence_ids", "created_at", "sent_at", "answered_at", "reply_summary", "reject_reason"] },
  { table: "validations", key: "validations", pk: ["id"], cols: ["id", "case_id", "scope_id", "tl_id", "proposed_level", "proposed_by", "evidence_ids", "confidence", "rationale", "decided_level", "reason", "decided_at", "decided_by"] },
  { table: "score_snapshots", key: "score_snapshots", pk: ["id"], cols: ["id", "case_id", "score", "band", "completeness", "capped", "breakdown", "profile_id", "computed_at", "simulated"] },
  { table: "one_on_ones", key: "one_on_ones", pk: ["id"], cols: ["id", "case_id", "rater_id", "rating_human", "rating_ai", "note", "held_at"] },
  { table: "checkins", key: "checkins", pk: ["id"], cols: ["id", "case_id", "scope_id", "self_score", "kt_rating", "doc_rating", "note", "at"] },
  { table: "stage_history", key: "stage_history", pk: ["case_id", "stage"], cols: ["case_id", "stage", "entered_at"] },
  { table: "doc_references", key: "doc_references", pk: ["id"], cols: ["id", "project_id", "path_id", "title", "folder_ref", "owner_label", "verified_at"] },
  { table: "done_steps", key: "done_steps", pk: ["step_key"], cols: ["step_key", "case_id", "done_at"] },
  { table: "skills", key: "skills", pk: ["id"], cols: ["id", "path_id", "name", "doc_ref", "coverage", "last_updated"] },
  { table: "challenges", key: "challenges", pk: ["id"], cols: ["id", "skill_id", "prompt", "approved_by", "created_by"] },
  { table: "challenge_results", key: "challenge_results", pk: ["id"], cols: ["id", "case_id", "challenge_id", "score", "reviewed_by", "submitted_at"] },
  { table: "benchmarks", key: "benchmarks", pk: ["path_id", "stage"], cols: ["path_id", "stage", "median_days", "n_completed", "provisional"] },
  { table: "path_suggestions", key: "path_suggestions", pk: ["id"], cols: ["id", "path_id", "suggestion", "cause_flag_ids", "status", "approved_by"] },
  { table: "audit_log", key: "audit_log", pk: ["id"], cols: ["id", "actor", "action", "entity", "entity_id", "payload", "agent", "model", "at"] },
];

export const rowKey = (def: TableDef, row: Record<string, unknown>) => def.pk.map((c) => String(row[c])).join("|");
