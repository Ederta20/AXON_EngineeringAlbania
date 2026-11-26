# AXON database: Supabase schema and mock data

Everything the backend and the agents need to run on Supabase. It matches what the front end already uses (`axon_initial_template_front/lib/types.ts`) and the database part of the brief (`Initial Scheme.pdf`, Parts 3, 5 and 6).

```
supabase/
  migrations/20261126000000_axon_schema.sql   tables, enums, rule views, screen views, RLS
  seed.sql                                     all mock rows (generated)
  data/csv/<table>.csv                         the same rows, one CSV per table (generated)
  data/axon_seed.json                          the same rows as one JSON file, for backend tests and agent fixtures (generated)
  scripts/generate-seed.ts                     source of the mock data
  scripts/generate.sh                          rebuilds seed.sql, the CSVs and the JSON
```

## Load it

**Supabase CLI** (recommended). `supabase db reset` applies `migrations/` and then runs `seed.sql`:

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db reset --linked
```

**SQL editor in the dashboard.** Paste and run `migrations/20261126000000_axon_schema.sql`, then `seed.sql`.

**CSV import (Table editor).** Run the migration first, then import the CSVs in the order listed in [Tables](#tables), because of the foreign keys. Arrays use Postgres format (`{"a","b"}`) and jsonb columns hold JSON text. Both import as they are.

The backend uses the **service-role key** for writes and agent calls (it bypasses RLS). Signed-in users read through RLS once `users.auth_user_id` links them to `auth.users`.

## The mock data

| Cases | Source |
|---|---|
| ONB-001 … ONB-010 | Student Starter Pack, exactly as in the front end's `lib/seed.ts` (same ids, values and evidence) |
| ONB-011 … ONB-020 | New fictional cases. Each covers a state that the pack does not have |

| Case | Employee | What it covers |
|---|---|---|
| ONB-011 | Sofia Kerr | **Upskill**, **closed**, outcome Ready. Every core scope validated, so the TL gate has passed. Used for benchmarks, the on-time rate and A9 |
| ONB-012 | Dan Holt | **Outcome** Ready with Support. One **TL override** of an AI proposal, with the required reason. TL and LM agree, so there is no conflict |
| ONB-013 | Mira Solis | **Setup**, senior. VPN is `approved` with an **A1 `proposed_state = usable`**. A Teams message with an ambiguous name is saved as **`needs_review`** |
| ONB-014 | Tariq Neal | **Rating gap**: the human rating is 8 and A6 gives 4, so the flag is raised. A4 draft waiting |
| ONB-015 | Elena Brandt | **Client requirement** (req-001/002) applied: new PCI scope (`added_by_requirement`), new access item, expected date moved earlier |
| ONB-016 | Jonah Reyes | **Future start** (19 Oct), everything confirmed. The clean case with **no flags** |
| ONB-017 | Priya Anand | **Per-scope check-ins**, pending A3 proposals, an AI extraction that failed validation (`needs_review`), a manually resolved flag, and a challenge submission waiting for review |
| ONB-018 | Ruben Ortega | **Closed loop**: an access delay was chased, the reply was matched (`answered`) and the flag resolved. A **rejected** draft |
| ONB-019 | Wes Calder | **At risk**: low score after 27 days in KT against a path median of 19, while the tracker still says On Track. **Approved** action in the outbox |
| ONB-020 | Gia Moretti | **Blocked**, with a reason the employee reported and an owner. **Draft** action for the PMO. The broken test environment also trips `rule_access_delay` |

The app clock is fixed at **2026-10-14** (`config.app_today`). Delete that row to use the real date.
Rows with `simulated = true` are fictional evidence that makes scores demoable, and the UI labels them.
The flags and the 2026-10-14 score snapshots are **not typed by hand**. The generator runs the app's own rules engine (`lib/rules.ts`) and score service (`lib/score.ts`), so the database holds exactly what the app computes. The SQL rule views give the same result: the original 13 starter-pack flags plus the new ones.

Row counts: 42 users, 20 cases, 44 scopes, 38 access items, 65 evidence, 20 flags (18 open), 6 actions (draft, approved, sent, answered and rejected), 20 validations (14 pending), 42 score snapshots, 88 audit entries.

**To change or add mock data**, edit `scripts/generate-seed.ts`, then run the generator (it needs `npm ci` in the front end first):

```bash
bash supabase/scripts/generate.sh
```

## Views (Part 3 queries, no AI)

| View | Feeds | Returns |
|---|---|---|
| `rule_stale` | C2 | Cases with no activity for more than `stale_days` |
| `rule_missing_info` | C2 | Missing project, role, LM, TL, readiness date, access record, or blocker reason |
| `rule_date_mismatch` | C2 | Cases that have started but are still in pre-onboarding |
| `rule_access_delay` | C2, L4 | Systems not usable after `escalate_days` |
| `rule_unanswered` | C2 | Sent actions past their due date |
| `rule_conflict` | C2, C3 | Same case and scope, different claims, different authors, within 7 days, not yet decided |
| `v_flags_board` | C2 | Open flags with employee, project, age and overdue |
| `v_score_components` | C3, L1, L3 | Each component's 0–100 value plus `tl_gate_passed` (weights are applied in `lib/score.ts`) |
| `v_validation_queue` | C5 | AI proposals waiting for the TL |
| `v_latest_score` | L1, L3 | Latest snapshot per case |
| `v_mgmt_overview` | L3, A8 | Active cases, average score, at-risk count, open flags by cause, on-time rate |

`axon_today()` and `axon_cfg_int(key)` read the config table. All views use `security_invoker`, so RLS applies to them.

## Tables

`?` means the column can be empty. An empty value is a gap that the rules look for, so leave it empty in the mock data rather than inventing a value.

Import order: clients → projects → paths → users → weight_profiles → config → cases → client_requirements → path_requirements → scopes → access_items → evidence → flags → actions → validations → score_snapshots → audit_log → one_on_ones → checkins → stage_history → doc_references → done_steps → skills → challenges → challenge_results → benchmarks → path_suggestions.

### Core

**users**: everyone, one role each. C1, all screens.
| column | type | notes |
|---|---|---|
| id | text PK | `u-pmo`, `u-tl-orion`, `u-e-005` |
| name, email, title | text | email is unique; all mock emails use `@example.test` |
| role | user_role | employee, hr, lm, tl, pmo, mgmt, core_manager, admin |
| project_id? | → projects | TLs |
| case_id? | text | employees only; `cases.employee_id` is the source of truth |
| auth_user_id? | uuid | links to `auth.users` for real sign-in and RLS |

**clients** (id, name) · **projects** (id, name, code unique, client_id?) · **paths** (id, project_id, role_name): a project plus a role is the unit for benchmarks and skills. A1 matches emails to a case by `projects.code` (for example NIM-482).

**cases**: one onboarding. C2, C3, C6, L1, all agents.
| column | type | notes |
|---|---|---|
| id | text PK | `ONB-001` |
| employee_id | → users | |
| movement_type | enum | new_hire, reallocation, upskill |
| project_id?, role?, path_id?, line_manager_id?, tl_id? | | gaps → `rule_missing_info` |
| start_date | date | |
| expected_ready_date? | date | gap → `rule_missing_info`; moved earlier by deadline requirements |
| stage | enum | pre_onboarding, setup, in_kt, awaiting_validation, outcome, closed |
| outcome? | enum | ready, ready_with_support, partially_ready (set by the TL only) |
| tracker_status, tracker_updated_at | text, date | what the old tracker says; shown against the computed status |
| profile_id | → weight_profiles | matched by role, movement type and seniority |
| seniority | enum | junior, mid, senior |

**scopes**: readiness per skill or scope. C3, C5, C6.
id, case_id, name, is_core, level (`not_started → shadowing → supported → independent → validated`), level_updated_at, added_by_requirement? (→ client_requirements).

**access_items**: one row per system per case. C3, L4, A1, A4.
id, case_id, system, state (`requested`, `approved`, `usable`; only usable counts), owner_label, requested_at, updated_at, next_followup_at?, note?, proposed_state? (an A1 proposal waiting for a person). Never store credentials here.

**evidence**: every fact behind a status. C3, A1 writes, A3 reads, rules.
| column | type | notes |
|---|---|---|
| id, case_id, scope_id? | | |
| kind | enum | email, tracker, tl_review, task, checkin, one_on_one, challenge |
| author_role | enum | user roles plus access_support, kt_owner, tm |
| author_label, author_id? | | |
| source_ref | text | reference only (`outlook://…`, `teams://…`, `tracker://…`), **never the message body** |
| occurred_at, summary | date, text | |
| claimed_status? | text | what the author claims; `rule_conflict` compares these |
| support_level? | enum | shadowing, supported, independent (tasks) |
| reworked, value_0_100? | bool, int | task score: 100/60/20, minus 20 if reworked; TL review 100/75/50/20 |
| disputed | bool | shown as "disputed" when it conflicts |
| extracted_by | text | `ai` or `manual` |
| status | enum | `ok`, or `needs_review` (A1 low confidence or invalid output); the score ignores `needs_review` |
| simulated | bool | fictional demo evidence |

**flags**: gaps found by rules or people. C2, C3, A2, A4.
id (`fl-<type>-<case_id>` for rule flags), case_id, type (blocked, stale, conflict, at_risk, unanswered, missing_info, access_delay, date_mismatch, client_requirement, rating_gap), severity (high, medium, low), cause_class? (process, compliance, external, individual), cause_confirmed (false means A2 proposed it), owner_id?, owner_label, suggested_owner?, raised_at, due_at, status (open, resolved), evidence_ids[], detail, root_cause? (A2 sentence), origin (rule, manual), rule?, resolved_at?, resolution?, **manually_resolved** (replaces the front end's `resolved_flag_ids`: rules must not reopen it).

**actions**: next steps. A4 drafts them, the PMO approves, the connector delivers. C4, outbox, A5.
id, case_id, flag_id, channel (teams, outlook), recipient, recipient_role, subject?, body (one ask per message), due_at, status (`draft → approved → sent → answered`, or `rejected`), approved_by?, thread_ref (A5 matches replies on this), evidence_ids[], created_at, sent_at?, answered_at?, reply_summary?, reject_reason?.

**validations**: TL sign-off. A3 proposes, the TL decides. C5.
id, case_id, scope_id, tl_id?, proposed_level, proposed_by (`ai`), evidence_ids[], confidence (0–1), rationale, decided_level? (TL only), reason? (**required when the TL overrides the proposal**; a check constraint enforces it), decided_at?, decided_by?.

**weight_profiles**: id, name, w_work, w_tl, w_1on1_human, w_1on1_ai, w_challenge (**at most 15**), w_self, version, active. X6.

**score_snapshots**: score history. C3, L1, L3, A8.
id, case_id, score, band (not_ready, partially_ready, ready_with_support, ready), completeness, capped, breakdown? (jsonb: `raw`, `tl_gate_passed`, `provisional`, `components[]`), profile_id, computed_at, simulated.

**config**: key/value jsonb. Keys: `app_today`, `stale_days` (10), `escalate_days` (5), `tl_cap` (84), `provisional_below` (60), `rating_gap` (2), `bands` (`{not_ready:0, partially_ready:40, ready_with_support:65, ready:85}`).

**audit_log**: every decision and every AI write. id, actor, actor_id?, action, entity, entity_id, payload? (jsonb), **agent?**, **model?**, at. The brief requires the agent name, its input ids and the model for every AI write. The mock rows use `model = 'mock-cache'` because the agents are mocked.

### Core-lite

| Table | Columns |
|---|---|
| one_on_ones | id, case_id, rater_id, rating_human (1–10), rating_ai? (1–10, A6), note, held_at. Staff only (RLS hides it from employees) |
| checkins | id, case_id, scope_id? (per-scope self-assessment), self_score (1–10), kt_rating? (1–5), doc_rating? (1–5), note, at |
| stage_history | case_id, stage, entered_at (PK case_id + stage); days per stage, benchmarks |
| doc_references | id, project_id, path_id?, title, folder_ref (reference only, never a copy), owner_label, verified_at? |
| clients | id, name |
| client_requirements | id, client_id?, project_id, path_id?, type (skill, access, deadline, compliance, scope), detail, effective_date?, affected_case_ids[], impact, status (proposed → submitted → approved/rejected), submitted_by?, approved_by?, reason?, created_at |
| path_requirements | path_id, requirement_id, added_at (new cases on the path inherit it) |
| done_steps | step_key (`acc-<access id>`, `kt-<scope>-<level>`, `ci-<case>-<date>`, `doc-<case>`), case_id, done_at; replaces the front end's `done_steps` |

### Extra

| Table | Columns |
|---|---|
| skills | id, path_id, name, doc_ref? (→ doc_references), coverage (0–100), last_updated. Metadata only, never document content |
| challenges | id, skill_id, prompt, approved_by? (empty until the TL approves), created_by (`ai`) |
| challenge_results | id, case_id, challenge_id, score? (empty until the TL reviews), reviewed_by?, submitted_at |
| benchmarks | path_id, stage, median_days, n_completed, provisional |
| path_suggestions | id, path_id, suggestion, cause_flag_ids[], status (proposed, approved, rejected), approved_by? |

## What each agent reads and writes

| Agent | Reads | Writes (always a proposal) |
|---|---|---|
| A1 Evidence Extractor | cases, projects.code, scopes, access_items | evidence (`extracted_by = ai`, `status` ok or needs_review), access_items.proposed_state |
| A2 Root-Cause Analyst | flags, evidence, past flags on the path | flags.cause_class, suggested_owner, root_cause (`cause_confirmed = false`) |
| A3 Readiness Assessor | scopes, evidence, validations, checkins | validations with `proposed_level` only |
| A4 Next-Action Drafter | flags, cases, users, access_items, config | actions (`status = draft`) |
| A5 Reply Listener | actions.thread_ref | actions `answered`, reply_summary, then evidence via A1 |
| A6 1:1 Scorer | one_on_ones (this rater's past ratings) | one_on_ones.rating_ai, a `rating_gap` flag when the gap is more than `config.rating_gap` |
| A7 Challenge Generator | skills, paths | challenges (`approved_by` empty) |
| A8 Report Writer | v_mgmt_overview, score_snapshots, flags | nothing (text only) |
| A9 Process Improver | stage_history, benchmarks, flags | benchmarks, path_suggestions (`proposed`) |
| A10 Requirements Assistant | projects, paths, cases, scopes, access_items | client_requirements (`proposed`) |

Every AI write also adds an `audit_log` row with `agent` and `model`.

## Differences from the front-end types

The front end still runs on its in-memory store. When the backend switches to Supabase:
- `Db.resolved_flag_ids` becomes `flags.manually_resolved`.
- `Db.done_steps` becomes the `done_steps` table.
- `Db.config` becomes rows in `config`, plus `app_today`.
- `score_snapshots` gains `id`, `profile_id` and `breakdown`, as in the brief.
- `audit_log` gains `actor_id`, `agent` and `model`.
- `users` gains `auth_user_id`.
