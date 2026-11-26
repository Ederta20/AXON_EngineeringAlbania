# AXON agents: how to implement them

Every agent already has a route, a fixed input, a fixed output schema (zod), a mock fallback and the code that saves its proposal to Supabase. To make an agent real you only:

1. **Once:** implement `generate()` in `axon_initial_template_front/lib/ai/callAgent.ts` (call Gemini, return the JSON text) and add `GEMINI_API_KEY` (plus optionally `GEMINI_MODEL`, `GEMINI_MODEL_SMALL`) to `.env.local`.
2. **Per agent:** write its prompt in `lib/ai/prompts.ts`. Describe the output JSON exactly as the `Out` schema in its route.

Nothing else changes: not the routes, not the screens, not the database.

## How a call works

```ts
const r = await callAgent({ agent: "A3", system: PROMPTS.A3, input, schema: Out, fallback: () => mock });
// r.output  -> always matches Out
// r.source  -> "ai" (model answered) or "mock" (no key, not implemented, or failed)
// r.status  -> "needs_review" if the model failed the schema twice
// r.agent, r.model -> written to audit_log.agent / audit_log.model by save()
```

- No `GEMINI_API_KEY`, or `generate()` not implemented: the mock answer is returned, so the app keeps working.
- Output that does not match the schema: one retry with the validation error, then the mock with `status: "needs_review"`.
- Routes then call `save(mutate, audit)`, which writes the proposal to Supabase, reruns the rules engine and logs the agent and model.

## Rules for every agent (from the brief)

- **Propose, never decide.** Agents never set `validations.decided_level`, `cases.outcome`, `flags.cause_confirmed = true`, `actions.approved_by` or `client_requirements.approved_by`.
- **Never invent facts.** Unknown dates, owners or scopes stay `null`; the rules turn gaps into flags.
- **Numbers come from SQL or code, not the model.** Due dates, scores and ages are passed in the input.
- **Cite evidence ids.**
- **Never store raw message text.** Only summaries and `source_ref` references.

## Agents

| # | Route | Input | Output (`Out` schema in the route) | Saves | Screen |
|---|---|---|---|---|---|
| A1 Evidence Extractor | `POST /api/agents/extract` | `{source_kind, source_ref, text, received_at, case_hint?}` + all cases with names, project codes, scopes, access | `{case_id, confidence, facts[{kind, scope_name, author_role, author_label, occurred_at, summary, claimed_status, support_level}], access_updates[{system, proposed_state}]}` | `evidence` rows (`extracted_by = ai`; `needs_review` if confidence < 0.6 or no case), `access_items.proposed_state` | C3 timeline, L4 |
| A2 Root-Cause Analyst | `POST /api/agents/analyze-flag` | `{flag_id}` + flag, case, its evidence, confirmed past flags on the path, LM/TL | `{cause_class, suggested_owner, sentence}` (all nullable) | `flags.cause_class`, `suggested_owner`, `root_cause`, `cause_confirmed = false`; skipped if a person already confirmed | C2, C3 |
| A3 Readiness Assessor | `POST /api/agents/assess` | `{case_id}` + case, unvalidated scopes, evidence, past validations, check-ins | `{scopes[{scope_id, proposed_level (shadowing/supported/independent), evidence_ids, confidence, rationale}], conflicts[]}` | `validations` with `proposed_level` (updates the open proposal for that scope, or adds one) | C5 |
| A4 Next-Action Drafter | `POST /api/agents/draft-action` | `{flag_id}` + flag, case, employee, LM/TL/owner, access items, `due_at` (from config) | `{channel, recipient, recipient_role, subject, body}` | `actions` row, `status = draft` | C4 drawer |
| A6 1:1 Scorer | `POST /api/agents/score-1on1` | `{case_id, rater_id, rating_human, note}` + the rater's past ratings | `{rating_ai (1-10 integer), rationale}` | `one_on_ones` row; `rating_gap` flag if the gap is above `config.rating_gap` | L2 pop-up |
| A10 Requirements Assistant | `POST /api/agents/requirements/parse` | `{text, project_hint?, user_id?}` + projects, paths, active cases | `{cards[{client_id, project_id, path_id, type, detail, effective_date, affected_case_ids, impact}], question}` | nothing (the manager submits, the Admin approves) | X7 |
| A5 Reply Listener | `POST /api/webhooks/inbound`, `/api/ingest/replies` | `{thread_ref, text, received_at}` | rule-based today | `actions.status = answered`, evidence | C4 |
| A7, A8, A9 | `/api/agents/challenges`, `report`, `improve` | see each route | mock today | follow the same pattern: add an `Out` schema, wrap the mock in `callAgent`, save with `save()` | X2, L3, X3 |

## Screens use the routes

With `NEXT_PUBLIC_DATA_SOURCE=api`, the screens call A4 (Draft next action), A6 (1:1 pop-up) and A10 (Requirements assistant) through these routes, so a real model shows up in the UI with no front-end change. In `mock` mode the screens keep the in-browser mocks.

## Test an agent

With `npm run dev` running and `.env.local` pointing at Supabase:

```bash
curl -X POST localhost:3000/api/agents/assess -H "content-type: application/json" -d "{\"case_id\":\"ONB-005\"}"
```

Check `source` ("ai" or "mock") and `status` in the response, and the new `audit_log` row (`agent`, `model`).

## Known limitations

- Writes to several tables are not one transaction (Supabase's REST API has none). If a write fails halfway, earlier tables in the same save can keep their rows.
- `PUT /api/db` (browser sync in api mode) accepts any row. It is a demo shortcut; move to per-action routes with role checks before real users.
