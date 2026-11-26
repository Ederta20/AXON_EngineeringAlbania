# AXON: when is a new hire ready?

AXON turns scattered onboarding updates (emails, Excel trackers, Teams messages) into evidence-based decisions. It **reveals the gaps**, **assesses readiness with evidence**, and **defines the next step and its owner**. AI proposes and people decide: only the Tech Lead can validate readiness.

Built by **Team AXON** (Arjola Metaliaj, Asja Xhelezi, Ederta Kariqi, Raniero Zanaj) for the **Engineering Albania Student Hackathon 2026**.

## Presentation

| | Link | https://canva.link/5i9z2p8i2eiutrk
| Live app | [axon-two-tau.vercel.app](https://axon-two-tau.vercel.app/) |

## How it works

Seven steps, from a scattered update to a validated decision:

| Step | What happens | Who |
|---|---|---|
| 1. Detect | Rules (SQL and code, no AI) raise flags on gaps: stale, missing info, access delay, conflicting updates… | System |
| 2. Triage | Each flag gets a cause and an owner. AI suggests the cause; the PMO confirms it | PMO |
| 3. Trace | The case page shows the evidence behind every status, with source and date | PMO, TL, LM |
| 4. Score | One readiness score (0–100), always explainable, capped until the TL validates | Score service |
| 5. Act | AI drafts the next message (Teams or Outlook); a person approves it before it is sent | PMO |
| 6. Validate | The Tech Lead confirms or overrides each scope with a reason, then sets the outcome | Tech Lead |
| 7. Update | Score, stage and flags refresh; the employee sees their next steps | Everyone |

Design principle: **less work, not another platform.** Each screen answers one question for one role, and opens with the action that role needs to take.

## Demo in 4 minutes

| Step | Sign in as | Do this |
|---|---|---|
| Detect, Triage | Sam Ortiz (PMO) | The flags board opens with the flags the rules raised. Filter, confirm a cause, assign an owner |
| Trace, Score | PMO | Open **Eva Stone**. Two conflicting updates sit side by side. Score 81, Ready with Support, locked until the TL validates |
| Act | PMO | **Draft next action**: approve the AI draft shown as a Teams preview, then **Simulate reply** |
| Validate | Ada Quinn (Tech Lead) | Validation queue: confirm each scope, then set the outcome with a reason |
| Update | PMO, then Eva Stone | The conflict resolves and the stage becomes Outcome. Eva sees her levels and next steps |

The full script and a second example (an access delay) are in the [front-end README](axon_initial_template_front/README.md#demo-script-core-flow-about-4-minutes). **Reset demo data** in the user menu restores the starting state.

## Roles

One platform, eight role-based views. Switch role any time from the header.

| Role | Question the screen answers | Home |
|---|---|---|
| PMO / Coordinator | Which gaps need an owner and a follow-up today? | Flags board |
| Tech Lead (also KT owner) | Whose readiness do I need to validate? | Validation queue |
| Employee | What do I do next, and how am I doing? | My path |
| Line Manager | How are my people progressing, and what blocks them? | My people |
| Management | Where is readiness at risk, and why? | Overview |
| HR | Did each onboarding start correctly? | Starts and movements |
| Core Manager | Which client requirements change onboarding? | Requirements assistant |
| Admin | Are weights, thresholds and requirement changes correct? | Configuration |

## The readiness score

One number from 0 to 100, computed in code ([`lib/score.ts`](axon_initial_template_front/lib/score.ts)), never by the model.

| Component | Default weight |
|---|---|
| Work evidence (tasks done independently, with support, or reworked) | 35 |
| Tech Lead review | 30 |
| 1:1 scores (human 10 + AI 5) | 15 |
| Skill challenges | 15 |
| Self-assessment | 5 |

- **Bands:** 0–39 Not ready · 40–64 Partially ready · 65–84 Ready with support · 85–100 Ready.
- **TL gate:** the score is capped at 84 until the Tech Lead validates every core scope.
- **Completeness:** under 60%, the score is shown as provisional.
- **Explainable:** "Why this score?" opens every component with its evidence.
- Weight profiles change the weights by role and movement type (new hire, transferee, upskill). The Admin edits them.

## AI agents

Every agent **proposes and never decides**. It cites evidence, leaves unknown facts empty, and never stores raw message text. All calls go through one place, [`lib/ai/callAgent.ts`](axon_initial_template_front/lib/ai/callAgent.ts), with a strict output schema and a mock fallback, so the app keeps working without a key.

| Agent | Does | Shown on |
|---|---|---|
| A1 Evidence Extractor | Turns an email, message or note into structured evidence for the right case | Case timeline, My access |
| A2 Root-Cause Analyst | Suggests a flag's cause class and owner | Flags board, case page |
| A3 Readiness Assessor | Proposes a level per scope from the evidence | Validation queue |
| A4 Next-Action Drafter | Drafts the follow-up message to the right person | Next-action drawer |
| A5 Reply Listener | Matches a reply to the message it answers | Next-action drawer |
| A6 1:1 Scorer | Scores a 1:1 note next to the human rating, calibrated to the rater | 1:1 pop-up |
| A7 Challenge Generator | Drafts skill challenges for the Tech Lead to approve | Skill challenges |
| A8 Report Writer | Writes the management summary from numbers computed in code | Overview |
| A9 Process Improver | Suggests onboarding template changes from confirmed root causes | Paths and benchmarks |
| A10 Requirements Assistant | Turns a client request in plain text into requirement cards | Requirements assistant |

Inputs, outputs, the pipeline and how to test each agent: [`spec/agents/README.md`](spec/agents/README.md).

## Architecture

```
 Emails, Teams, trackers, repos, notes
            │   (read only outside AXON)
            ▼
 Connectors  /connectors        path collector · mock replay · warm-up
            │   signed with CONNECTOR_SECRET, structured fields only
            ▼
 Next.js app  axon_initial_template_front
   ├─ screens        app/(app)/…        one view per role
   ├─ API routes     app/api/…          ingest, flags, actions, validations, score, agents A1–A10
   ├─ rules engine   lib/rules.ts       raises and resolves flags (no AI)
   ├─ score service  lib/score.ts       weights × values, TL gate, completeness
   └─ AI gateway     lib/ai/callAgent.ts   the only code that calls Gemini
            │
            ▼
 Supabase (Postgres)  /supabase         27 tables, rule views, screen views, row-level security
```

Stack: Next.js 14 (App Router) and TypeScript, Supabase (Postgres), Google Gemini, zod, ApexCharts, lucide icons.

## Repository map

```
axon_initial_template_front/   the app: screens, API routes, rules, score, agents, connectors
  app/(app)/                   screens per role
  app/api/                     API routes (contract in the front-end README)
  components/                  shell, UI kit, charts, next-action drawer, 1:1 pop-up, logo
  lib/                         types, rules engine, score service, store, selectors, AI gateway
  connectors/                  path collector, mock replay, cache warm-up
  public/docs/                 fictional demo documents that the document links open
supabase/                      schema migration, seed data (SQL, CSV, JSON), generator
spec/agents/                   agent specification: inputs, outputs, pipeline, tests
Initial Scheme.pdf             the original project brief
```

## Data and privacy rules

- **AXON never reads email or chat.** Connectors outside the app send structured evidence through a signed API. The app stores summaries and a `source_ref`, never raw message text.
- **People decide.** Agents never validate a scope, set an outcome, confirm a cause or approve a message.
- **Numbers come from code or SQL**, never from the model: scores, counts, ages and dates.
- **Documents stay where they are.** AXON stores only a document's title, folder and link.
- Every piece of AI output is marked "Proposed by AI"; every human decision shows who made it and when.

## What is simulated

All people, projects and clients are fictional and come from the Student Starter Pack (cases ONB-001 to ONB-010, plus ONB-011 to ONB-020 added to cover more states). Teams and Outlook delivery is simulated, and the app clock is fixed at 14 Oct 2026 so ages and deadlines are the same on every run. Simulated data is labeled "Simulated" in the app.

## More documentation

| Topic | File |
|---|---|
| Screens, demo script, API contract, design rules | [`axon_initial_template_front/README.md`](axon_initial_template_front/README.md) |
| Database tables, views and mock data | [`supabase/README.md`](supabase/README.md) |
| AI agents and the pipeline | [`spec/agents/README.md`](spec/agents/README.md) |
