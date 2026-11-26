-- AXON schema for Supabase (Postgres 15+).
-- Mirrors axon_initial_template_front/lib/types.ts and the project brief (Initial Scheme.pdf, Parts 3, 5, 6).
-- Text primary keys keep the ids the front end already uses (ONB-001, u-pmo, fl-conflict-ONB-005, ...).
-- Nullable columns are where onboarding gaps show up: the rule views look for them.
-- Statuses are never stored as truth: stage, flags and score are computed from evidence and written as snapshots.

-- ───────────────────────────── Enums ─────────────────────────────
create type user_role            as enum ('employee','hr','lm','tl','pmo','mgmt','core_manager','admin');
create type evidence_author_role as enum ('employee','hr','lm','tl','pmo','mgmt','core_manager','admin','access_support','kt_owner','tm');
create type movement_type        as enum ('new_hire','reallocation','upskill');
create type case_stage           as enum ('pre_onboarding','setup','in_kt','awaiting_validation','outcome','closed');
create type readiness_outcome    as enum ('ready','ready_with_support','partially_ready');
create type seniority_level      as enum ('junior','mid','senior');
create type scope_level          as enum ('not_started','shadowing','supported','independent','validated');
create type access_state         as enum ('requested','approved','usable');
create type evidence_kind        as enum ('email','tracker','tl_review','task','checkin','one_on_one','challenge');
create type support_level        as enum ('shadowing','supported','independent');
create type evidence_status      as enum ('ok','needs_review');
create type flag_type            as enum ('blocked','stale','conflict','at_risk','unanswered','missing_info','access_delay','date_mismatch','client_requirement','rating_gap');
create type cause_class          as enum ('process','compliance','external','individual');
create type flag_severity        as enum ('high','medium','low');
create type flag_status          as enum ('open','resolved');
create type flag_origin          as enum ('rule','manual');
create type action_channel       as enum ('teams','outlook');
create type action_status        as enum ('draft','approved','sent','rejected','answered');
create type readiness_band       as enum ('not_ready','partially_ready','ready_with_support','ready');
create type proposal_status      as enum ('proposed','approved','rejected');
create type requirement_type     as enum ('skill','access','deadline','compliance','scope');
create type requirement_status   as enum ('proposed','submitted','approved','rejected');

-- ───────────────────────────── Core reference tables ─────────────────────────────
create table clients (
  id   text primary key,
  name text not null
);

create table projects (
  id        text primary key,
  name      text not null,
  code      text not null unique,             -- e.g. NIM-482, used by A1 to match emails to a case
  client_id text references clients(id)
);

create table paths (
  id         text primary key,
  project_id text not null references projects(id),
  role_name  text not null                    -- project + role = unit for benchmarks and skills
);

create table users (
  id           text primary key,
  name         text not null,
  email        text not null unique,
  role         user_role not null,
  title        text not null,
  project_id   text references projects(id),
  case_id      text,                          -- employees only; convenience link, cases.employee_id is the source of truth
  auth_user_id uuid unique,                   -- link to auth.users once real sign-in is used
  created_at   timestamptz not null default now()
);

create table weight_profiles (
  id           text primary key,
  name         text not null,
  w_work       int not null check (w_work between 0 and 100),
  w_tl         int not null check (w_tl between 0 and 100),
  w_1on1_human int not null check (w_1on1_human between 0 and 100),
  w_1on1_ai    int not null check (w_1on1_ai between 0 and 100),
  w_challenge  int not null check (w_challenge between 0 and 15),   -- never above 15
  w_self       int not null check (w_self between 0 and 100),
  version      int not null default 1,
  active       boolean not null default true
);

-- Thresholds. value is jsonb so bands can be an object; read ints with (value #>> '{}')::int.
create table config (
  key         text primary key,
  value       jsonb not null,
  description text
);

-- ───────────────────────────── Cases and their facts ─────────────────────────────
create table cases (
  id                  text primary key,       -- ONB-001
  employee_id         text not null references users(id),
  movement_type       movement_type not null,
  project_id          text references projects(id),
  role                text,                   -- exact role; null = gap
  path_id             text references paths(id),
  line_manager_id     text references users(id),
  tl_id               text references users(id),
  start_date          date not null,
  expected_ready_date date,
  stage               case_stage not null,
  outcome             readiness_outcome,
  tracker_status      text not null default '',  -- what the old tracker says; compared with the computed status
  tracker_updated_at  date not null,
  profile_id          text not null references weight_profiles(id),
  seniority           seniority_level not null default 'mid'
);
create index on cases (stage);
create index on cases (tl_id);
create index on cases (line_manager_id);

create table client_requirements (
  id                text primary key,
  client_id         text references clients(id),
  project_id        text not null references projects(id),
  path_id           text references paths(id),
  type              requirement_type not null,
  detail            text not null,
  effective_date    date,
  affected_case_ids text[] not null default '{}',
  impact            text not null default '',
  status            requirement_status not null default 'proposed',
  submitted_by      text references users(id),
  approved_by       text references users(id),
  reason            text,
  created_at        date not null default current_date
);

create table path_requirements (
  path_id        text not null references paths(id),
  requirement_id text not null references client_requirements(id),
  added_at       date not null default current_date,
  primary key (path_id, requirement_id)
);

create table scopes (
  id                   text primary key,
  case_id              text not null references cases(id) on delete cascade,
  name                 text not null,
  is_core              boolean not null default true,
  level                scope_level not null default 'not_started',
  level_updated_at     date not null,
  added_by_requirement text references client_requirements(id)
);
create index on scopes (case_id);

create table access_items (
  id               text primary key,
  case_id          text not null references cases(id) on delete cascade,
  system           text not null,
  state            access_state not null,
  owner_label      text not null,
  requested_at     date not null,
  updated_at       date not null,
  next_followup_at date,
  note             text,
  proposed_state   access_state                -- A1 proposal waiting for a person
);
create index on access_items (case_id);

create table evidence (
  id              text primary key,
  case_id         text not null references cases(id) on delete cascade,
  scope_id        text references scopes(id),
  kind            evidence_kind not null,
  author_role     evidence_author_role not null,
  author_label    text not null,
  author_id       text references users(id),
  source_ref      text not null,               -- reference only, never the raw message body
  occurred_at     date not null,
  summary         text not null,
  claimed_status  text,
  support_level   support_level,
  reworked        boolean not null default false,
  value_0_100     int check (value_0_100 between 0 and 100),
  disputed        boolean not null default false,
  extracted_by    text not null default 'manual',   -- 'ai' | 'manual'
  status          evidence_status not null default 'ok',
  simulated       boolean not null default false
);
create index on evidence (case_id, occurred_at desc);
create index on evidence (scope_id);

create table flags (
  id                text primary key,          -- fl-<type>-<case_id> for rule flags
  case_id           text not null references cases(id) on delete cascade,
  type              flag_type not null,
  severity          flag_severity not null,
  cause_class       cause_class,
  cause_confirmed   boolean not null default false,   -- false = proposed by A2
  owner_id          text references users(id),
  owner_label       text not null,
  suggested_owner   text,
  raised_at         date not null,
  due_at            date not null,
  status            flag_status not null default 'open',
  evidence_ids      text[] not null default '{}',
  detail            text not null,
  root_cause        text,                      -- A2 sentence
  origin            flag_origin not null,
  rule              text,                      -- rule_stale, rule_missing_info, ...
  resolved_at       date,
  resolution        text,
  manually_resolved boolean not null default false   -- replaces the front end's resolved_flag_ids: rules must not reopen it
);
create index on flags (case_id);
create index on flags (status, type);

create table actions (
  id             text primary key,
  case_id        text not null references cases(id) on delete cascade,
  flag_id        text not null references flags(id),
  channel        action_channel not null,
  recipient      text not null,
  recipient_role text not null,
  subject        text,
  body           text not null,
  due_at         date not null,
  status         action_status not null default 'draft',
  approved_by    text references users(id),
  thread_ref     text not null,               -- how A5 matches a reply to this action
  evidence_ids   text[] not null default '{}',
  created_at     date not null,
  sent_at        date,
  answered_at    date,
  reply_summary  text,
  reject_reason  text
);
create index on actions (status);
create index on actions (thread_ref);

create table validations (
  id             text primary key,
  case_id        text not null references cases(id) on delete cascade,
  scope_id       text not null references scopes(id) on delete cascade,
  tl_id          text references users(id),
  proposed_level scope_level not null,
  proposed_by    text not null default 'ai',
  evidence_ids   text[] not null default '{}',
  confidence     numeric(3,2) not null check (confidence between 0 and 1),
  rationale      text not null,
  decided_level  scope_level,                 -- only the TL sets this
  reason         text,                        -- mandatory when overriding
  decided_at     date,
  decided_by     text references users(id),
  constraint override_needs_reason check (decided_level is null or decided_level = proposed_level or reason is not null)
);
create index on validations (case_id);

create table score_snapshots (
  id           text primary key,
  case_id      text not null references cases(id) on delete cascade,
  score        int not null check (score between 0 and 100),
  band         readiness_band not null,
  completeness int not null check (completeness between 0 and 100),
  capped       boolean not null default false,
  breakdown    jsonb,                          -- ScoreComponent[] + tl_gate_passed, provisional, raw
  profile_id   text references weight_profiles(id),
  computed_at  date not null,
  simulated    boolean not null default false
);
create index on score_snapshots (case_id, computed_at desc);

create table audit_log (
  id        text primary key,
  actor     text not null,                     -- display label, e.g. "Ada Quinn (Tech Lead)" or "A3 Readiness Assessor"
  actor_id  text references users(id),
  action    text not null,
  entity    text not null,
  entity_id text not null,
  payload   jsonb,
  agent     text,                              -- set for AI writes: agent name
  model     text,                              -- set for AI writes: model used
  at        timestamptz not null default now()
);
create index on audit_log (entity, entity_id);

-- ───────────────────────────── Core-lite ─────────────────────────────
create table one_on_ones (
  id           text primary key,
  case_id      text not null references cases(id) on delete cascade,
  rater_id     text not null references users(id),
  rating_human int not null check (rating_human between 1 and 10),
  rating_ai    int check (rating_ai between 1 and 10),
  note         text not null default '',
  held_at      date not null
);

create table checkins (
  id         text primary key,
  case_id    text not null references cases(id) on delete cascade,
  scope_id   text references scopes(id),
  self_score int not null check (self_score between 1 and 10),
  kt_rating  int check (kt_rating between 1 and 5),
  doc_rating int check (doc_rating between 1 and 5),
  note       text not null default '',
  at         date not null
);

create table stage_history (
  case_id    text not null references cases(id) on delete cascade,
  stage      case_stage not null,
  entered_at date not null,
  primary key (case_id, stage)
);

create table doc_references (
  id          text primary key,
  project_id  text not null references projects(id),
  path_id     text references paths(id),
  title       text not null,
  folder_ref  text not null,                   -- folder reference only, never a copy
  owner_label text not null,
  verified_at date
);

-- Employee next-step keys marked done on C6 (front end: Db.done_steps).
create table done_steps (
  step_key text primary key,                   -- acc-<access_id> | kt-<scope_id>-<level> | ci-<case_id>-<date> | doc-<case_id>
  case_id  text not null references cases(id) on delete cascade,
  done_at  date not null default current_date
);

-- ───────────────────────────── Extra ─────────────────────────────
create table skills (
  id           text primary key,
  path_id      text not null references paths(id),
  name         text not null,
  doc_ref      text references doc_references(id),
  coverage     int not null check (coverage between 0 and 100),
  last_updated date not null
);

create table challenges (
  id          text primary key,
  skill_id    text not null references skills(id),
  prompt      text not null,
  approved_by text references users(id),        -- empty until the TL approves
  created_by  text not null default 'ai'
);

create table challenge_results (
  id           text primary key,
  case_id      text not null references cases(id) on delete cascade,
  challenge_id text not null references challenges(id),
  score        int check (score between 0 and 100),
  reviewed_by  text references users(id),
  submitted_at date not null
);

create table benchmarks (
  path_id     text not null references paths(id),
  stage       case_stage not null,
  median_days int not null,
  n_completed int not null default 0,
  provisional boolean not null default true,
  primary key (path_id, stage)
);

create table path_suggestions (
  id             text primary key,
  path_id        text not null references paths(id),
  suggestion     text not null,
  cause_flag_ids text[] not null default '{}',
  status         proposal_status not null default 'proposed',
  approved_by    text references users(id)
);

-- ───────────────────────────── Helpers ─────────────────────────────
-- App clock: config.app_today pins "today" (2026-10-14 for the demo); remove the row to use the real date.
create or replace function axon_today() returns date
language sql stable as $$
  select coalesce((select (value #>> '{}')::date from config where key = 'app_today'), current_date)
$$;

create or replace function axon_cfg_int(k text) returns int
language sql stable as $$ select (value #>> '{}')::int from config where key = k $$;

-- ───────────────────────────── Rule views (Part 3; no AI) ─────────────────────────────
-- rule_stale: last activity = latest of tracker update and evidence (PMO's own emails excluded).
create view rule_stale with (security_invoker = true) as
with last as (
  select c.id as case_id, c.line_manager_id,
         greatest(c.tracker_updated_at,
                  coalesce((select max(e.occurred_at) from evidence e
                             where e.case_id = c.id and not (e.kind = 'email' and e.author_role = 'pmo')),
                           c.tracker_updated_at)) as last_activity
  from cases c where c.stage <> 'closed'
)
select case_id, 'stale'::flag_type as type, last_activity, axon_today() - last_activity as days, line_manager_id as owner_id
from last
where axon_today() - last_activity > axon_cfg_int('stale_days');

create view rule_missing_info with (security_invoker = true) as
select c.id as case_id, 'missing_info'::flag_type as type,
  concat_ws(', ',
    case when c.project_id is null then 'project' end,
    case when c.role is null then 'exact role' end,
    case when c.line_manager_id is null then 'line manager' end,
    case when c.tl_id is null then 'TL / KT owner' end,
    case when c.expected_ready_date is null then 'expected readiness date' end,
    case when c.stage <> 'pre_onboarding' and not exists (select 1 from access_items a where a.case_id = c.id) then 'access record' end,
    case when c.tracker_status = 'Blocked' and not exists (
      select 1 from evidence e where e.case_id = c.id and e.kind <> 'tracker' and e.summary ilike '%block%') then 'blocker reason and owner' end
  ) as detail
from cases c
where c.stage <> 'closed'
  and (c.project_id is null or c.role is null or c.line_manager_id is null or c.tl_id is null or c.expected_ready_date is null
       or (c.stage <> 'pre_onboarding' and not exists (select 1 from access_items a where a.case_id = c.id))
       or (c.tracker_status = 'Blocked' and not exists (
            select 1 from evidence e where e.case_id = c.id and e.kind <> 'tracker' and e.summary ilike '%block%')));

create view rule_date_mismatch with (security_invoker = true) as
select id as case_id, 'date_mismatch'::flag_type as type, axon_today() - start_date as days
from cases
where stage = 'pre_onboarding' and start_date <= axon_today() and project_id is not null;

create view rule_access_delay with (security_invoker = true) as
select a.case_id, a.id as access_item_id, a.system, a.state, a.owner_label, 'access_delay'::flag_type as type,
       axon_today() - a.requested_at as days
from access_items a join cases c on c.id = a.case_id
where c.stage <> 'closed' and a.state <> 'usable'
  and axon_today() - a.requested_at > axon_cfg_int('escalate_days');

create view rule_unanswered with (security_invoker = true) as
select case_id, id as action_id, recipient, recipient_role, 'unanswered'::flag_type as type, axon_today() - due_at as days_overdue
from actions
where status = 'sent' and due_at < axon_today();

create view rule_conflict with (security_invoker = true) as
select a.case_id, a.scope_id, 'conflict'::flag_type as type, a.id as evidence_a, b.id as evidence_b,
       a.claimed_status as claim_a, b.claimed_status as claim_b, a.author_label as author_a, b.author_label as author_b
from evidence a
join evidence b on a.case_id = b.case_id
  and coalesce(a.scope_id, '') = coalesce(b.scope_id, '')
  and a.id < b.id
join cases c on c.id = a.case_id
where a.claimed_status is not null and b.claimed_status is not null
  and a.kind in ('tl_review','email','checkin') and b.kind in ('tl_review','email','checkin')
  and a.author_role <> 'pmo' and b.author_role <> 'pmo'
  and a.claimed_status <> b.claimed_status
  and a.author_role <> b.author_role
  and abs(a.occurred_at - b.occurred_at) <= 7
  and c.stage <> 'closed' and c.outcome is null
  and not exists (select 1 from validations v where v.case_id = a.case_id and v.decided_at >= greatest(a.occurred_at, b.occurred_at));

-- ───────────────────────────── Screen views ─────────────────────────────
create view v_flags_board with (security_invoker = true) as
select f.id, f.case_id, u.name as employee, p.name as project, f.type, f.severity, f.cause_class, f.cause_confirmed,
       f.owner_id, f.owner_label, f.suggested_owner, f.raised_at, f.due_at,
       axon_today() - f.raised_at as age_days, f.due_at < axon_today() as overdue, f.detail, f.root_cause, f.evidence_ids, f.origin
from flags f
join cases c on c.id = f.case_id
join users u on u.id = c.employee_id
left join projects p on p.id = c.project_id
where f.status = 'open';

-- One row per case with each component's 0-100 value; weights are applied in the score service (lib/score.ts).
create view v_score_components with (security_invoker = true) as
select c.id as case_id, c.profile_id,
  (select avg(t.value_0_100) from (select value_0_100 from evidence
     where case_id = c.id and kind = 'task' and status = 'ok' and value_0_100 is not null
     order by occurred_at desc limit 8) t) as work,
  (select value_0_100 from evidence
     where case_id = c.id and kind = 'tl_review' and status = 'ok' and value_0_100 is not null
     order by occurred_at desc limit 1) as tl_review,
  (select avg(r.rating_human) * 10 from (select rating_human from one_on_ones where case_id = c.id order by held_at desc limit 3) r) as one_on_one_human,
  (select avg(r.rating_ai) * 10 from (select rating_ai from one_on_ones where case_id = c.id order by held_at desc limit 3) r) as one_on_one_ai,
  (select avg(score) from challenge_results where case_id = c.id and score is not null) as challenge,
  (select avg(r.self_score) * 10 from (select self_score from checkins where case_id = c.id order by at desc limit 3) r) as self,
  exists (select 1 from scopes s where s.case_id = c.id and s.is_core)
    and not exists (select 1 from scopes s where s.case_id = c.id and s.is_core and s.level <> 'validated') as tl_gate_passed
from cases c;

create view v_validation_queue with (security_invoker = true) as
select v.id, v.case_id, u.name as employee, v.scope_id, s.name as scope_name, s.is_core, s.level as current_level,
       v.tl_id, v.proposed_level, v.confidence, v.rationale, v.evidence_ids,
       axon_today() - s.level_updated_at as days_waiting
from validations v
join scopes s on s.id = v.scope_id
join cases c on c.id = v.case_id
join users u on u.id = c.employee_id
where v.decided_level is null;

create view v_latest_score with (security_invoker = true) as
select distinct on (case_id) case_id, score, band, completeness, capped, computed_at
from score_snapshots
order by case_id, computed_at desc, simulated asc;

create view v_mgmt_overview with (security_invoker = true) as
with active as (
  select c.*, ls.score, ls.band,
         axon_today() - (select max(entered_at) from stage_history h where h.case_id = c.id and h.stage = c.stage) as days_in_stage,
         b.median_days
  from cases c
  left join v_latest_score ls on ls.case_id = c.id
  left join benchmarks b on b.path_id = c.path_id and b.stage = c.stage
  where c.stage <> 'closed'
),
finished as (
  select c.id, c.expected_ready_date, (select min(entered_at) from stage_history h where h.case_id = c.id and h.stage = 'outcome') as outcome_at
  from cases c where c.outcome is not null
)
select
  (select count(*) from active) as active_cases,
  (select round(avg(score)) from active where score is not null) as avg_score,
  (select count(*) from active where band in ('not_ready','partially_ready') and days_in_stage > median_days) as at_risk_count,
  (select count(*) from flags where status = 'open') as open_flags,
  (select jsonb_object_agg(coalesce(cause_class::text, 'unclassified'), n)
     from (select cause_class, count(*) n from flags where status = 'open' group by cause_class) x) as open_flags_by_cause,
  (select round(100.0 * count(*) filter (where outcome_at <= expected_ready_date) / nullif(count(*), 0)) from finished) as on_time_readiness_pct;

-- ───────────────────────────── Row-level security ─────────────────────────────
-- The Next.js API routes use the service-role key (bypasses RLS) for writes and agent work.
-- Signed-in users (auth.users linked through users.auth_user_id) read through these policies:
-- employees see only their own case and never 1:1 ratings; every other role reads everything.
create or replace function axon_current_user() returns users
language sql stable security definer set search_path = public as $$
  select * from users where auth_user_id = auth.uid() limit 1
$$;

create or replace function axon_can_read_case(target_case text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select u.role <> 'employee' or u.case_id = target_case from users u where u.auth_user_id = auth.uid()), false)
$$;

create or replace function axon_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role <> 'employee' from users where auth_user_id = auth.uid()), false)
$$;

do $$
declare t text;
begin
  -- Reference tables: any signed-in user can read.
  foreach t in array array['clients','projects','paths','users','weight_profiles','config','doc_references','skills','challenges','benchmarks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_read', t);
  end loop;
  -- Case-scoped tables: employees see their own case only.
  foreach t in array array['cases','scopes','access_items','evidence','flags','actions','validations','score_snapshots','checkins','stage_history','done_steps','challenge_results'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (axon_can_read_case(%s))', t || '_read', t,
                   case when t = 'cases' then 'id' else 'case_id' end);
  end loop;
  -- Staff-only tables: 1:1 ratings (the employee never sees them), requirements, suggestions, audit.
  foreach t in array array['one_on_ones','client_requirements','path_requirements','path_suggestions','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (axon_is_staff())', t || '_read', t);
  end loop;
end $$;
