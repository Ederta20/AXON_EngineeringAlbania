# AXON: onboarding and knowledge transfer

Team AXON (Arjola Metaliaj, Asja Xhelezi, Ederta Kariqi, Raniero Zanaj). Engineering Albania Student Hackathon 2026.

AXON answers one question: **when is a new hire ready?** It finds onboarding gaps, shows the evidence behind each status, scores readiness, and drafts the next step for its owner. AI proposes and people decide. Only the Tech Lead can validate readiness.

All data is fictional and comes from the Student Starter Pack. Teams and Outlook are simulated. The app clock is fixed at **14 Oct 2026**, so ages and deadlines come out the same on every run.

## Run it

```bash
npm install
cp .env.example .env.local   # values come from Arjola by DM; the front end runs without them
npm run dev                  # http://localhost:3000
```

Node 18.17 or newer. `npm run build` must pass before every push.

## Setup (Gemini backend)

1. `cp .env.example .env.local` and fill in `GEMINI_API_KEY` (you got it by DM) and `CONNECTOR_SECRET`. Never commit `.env.local`.
2. `npm install`
3. `npm run dev`
4. Mock connector: `cp connectors/.env.example connectors/.env`, set the same `CONNECTOR_SECRET`, then `npx tsx connectors/mock/replay.ts`. It posts `seed/starter-pack.json` to `/api/ingest/evidence`.
5. Try the A3 agent: `curl -X POST localhost:3000/api/agents/assess -H 'content-type: application/json' -d '{"case_id":"ONB-005"}'`

On Vercel, add the same variables under Project → Settings → Environment Variables. Only `lib/ai/callAgent.ts` talks to Gemini; prompts live in `spec/agents/prompts.ts`.

## Demo script (core flow, about 4 minutes)

| Step | Sign in as | Do this |
|---|---|---|
| 1. Detect | Sam Ortiz (PMO) | The flags board opens with 13 flags that the rules raised from the starter pack. |
| 2. Triage | PMO | Filter by type or owner, confirm an AI-proposed cause, or bulk-assign an owner. |
| 3. Trace | PMO | Open **Eva Stone (ONB-005)**. The two conflicting updates sit side by side with their source references. |
| 4. Score | PMO | Score 81, Ready with Support, 100% complete, TL gate locked (0/4). "Why this score?" opens the breakdown. |
| 5. Act | PMO | **Draft next action**: the AI draft appears as a Teams preview. Approve it; the mock connector delivers it. Use **Simulate reply** to send an answer back. |
| 6. Validate | Ada Quinn (TL) | In the validation queue, validate the standard scopes, confirm the complex scenarios as Supported or Shadowing, and set the outcome with a reason. |
| 7. Update | PMO, then Eva | The conflict flag resolves and the stage becomes Outcome. Eva's path shows her levels and next steps. |

Second example: **Leo Marin (ONB-002)** has an access delay. Draft and approve the follow-up to the Orion Portal app owner, then simulate the reply. Sign in as Leo, open My access and press "It works" on Nova VPN.

Use **Reset demo** in the header to restore the starter pack.

## Screens

| # | Screen | Route | Role | Tier |
|---|---|---|---|---|
| C1 | Role switcher and login | `/login` + header menu | All | Core |
| C2 | Flags board | `/flags` | PMO (Admin can view) | Core |
| C3 | Case detail, panels by role | `/cases/[id]` | All | Core |
| C4 | Next-action drawer (Teams/Outlook preview) | drawer on C2 and C3 | PMO | Core |
| C5 | Validation queue + outcome | `/validation` | TL | Core |
| C6 | My path | `/path` | Employee | Core |
| L1 | My people / all onboardings | `/people` | TL, LM, PMO, HR, Mgmt | Core-lite |
| L2 | 1:1 rating pop-up | modal on L1 and C3 | TL, LM | Core-lite |
| L3 | Management overview | `/overview` | Mgmt, Core Manager | Core-lite |
| L4 | My access | `/access` | Employee | Core-lite |
| L5 | Check-in and feedback | `/checkin` | Employee | Core-lite |
| X7 | Requirements assistant | `/requirements` | Core Manager | Core-lite |
| X1–X6 | Skills, challenges, benchmarks, root causes, starts, configuration | `/skills` `/challenges` `/benchmarks` `/root-cause` `/starts` `/config` | various | Extra |

Role panels on C3: the Employee sees no 1:1 scores, HR sees start information and flags only (no score), and Management sees the score and flags only.

## Code map

```
app/(app)/…            screens (client components)
app/api/…              API routes with the final contracts (in-memory store for now)
components/            Shell, UI kit (ui.tsx), charts, C4 drawer, L2 modal
lib/types.ts           domain types = the Postgres tables in the brief (Part 3, 5, 6)
lib/seed.ts            starter-pack seed; rows marked simulated: true are labeled in the UI
lib/rules.ts           rules engine (rule_stale, rule_missing_info, rule_date_mismatch,
                       rule_access_delay, rule_unanswered, rule_conflict) + cached A2 causes
lib/score.ts           score service: weights × values, completeness, TL gate cap at 84
lib/agents.ts          mock agent outputs (A4 drafts, A5 replies, A6 scorer, A10 parser)
lib/store.tsx          browser demo store; every action names the API route it maps to
lib/server/            in-memory db for API routes, connector signature check
```

## Hooking up the backend

1. **Done:** `lib/server/db.ts` reads and writes Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set in `.env.local` (schema and seed in `/supabase`). Without them it falls back to the in-memory seed. `save()` reruns the rules engine and writes back only the changed rows; `lib/server/tables.ts` maps each table.
2. In each `app/api/agents/*/route.ts`, swap the mock for `callAgent(...)` (see the TODO in each file and the backend setup doc). Only `lib/ai/callAgent.ts` may import the Gemini SDK.
3. **Done:** with `NEXT_PUBLIC_DATA_SOURCE=api`, `lib/store.tsx` loads everything from `GET /api/db` and, after each action, sends only the changed rows to `PUT /api/db` (`lib/dbdiff.ts`). The server writes them to Supabase, reruns the rules and returns the new state. **Reset demo** reloads from the database instead of the seed. Demo shortcut: `PUT /api/db` accepts any row; move to the per-action routes with role checks before real users.
4. Connectors (`/connectors`, separate process) talk only to `/api/ingest/*` and `/api/outbox`, signed with `CONNECTOR_SECRET`. AXON never reads mail or chat.

### API contract

| Route | Method | Purpose |
|---|---|---|
| `/api/cases`, `/api/cases/:id` | GET | Case list with score summary; full case detail |
| `/api/cases/:id/outcome` | POST | TL sets the outcome (reason required) |
| `/api/flags`, `/api/flags/:id` | GET, PATCH | Flags board (`v_flags_board`); owner, cause, resolve |
| `/api/actions/:id` | PATCH | Edit, approve (to the outbox) or reject a draft |
| `/api/validations/:id/decide` | POST | TL confirms, or overrides with a reason |
| `/api/score/:caseId` | GET | Score service output |
| `/api/agents/extract` · `analyze-flag` · `assess` · `draft-action` · `score-1on1` · `challenges` · `report` · `improve` · `requirements/parse` | POST | A1–A10. They return proposals only |
| `/api/ingest/evidence` · `skills` · `replies` | POST | Connector to AXON. Structured fields only; unknown fields are rejected |
| `/api/webhooks/inbound` | POST | A5 entry point (same contract as `ingest/replies`) |
| `/api/outbox`, `/api/outbox/:id/delivered` | GET, POST | Outbound Sender reads approved actions and confirms delivery |
| `/api/requirements/:id/submit`, `/api/requirements/:id` | POST, PATCH | X7 submit; Admin approve or reject |

## Design rules used

- Palette: Engineering Albania (Midnight #190D38, Deep #301B69, Violet #5935AF, Soft Violet #8261D1, Blue #354ED8, Lavender #F4F2FA). **#FF5B00** is reserved for highlights: chart lines, the score arc and the active nav marker. It is never used for text.
- Glass surfaces over a quiet brand field. Every status has a label and an icon or shape, never color alone.
- **AI output** has a dashed violet "Proposed by AI" chip. **Human decisions** have a solid "Validated by … · date" chip.
- Three states are kept visually distinct: case stage (rectangular chip), scope level (5-step stepper) and flags (tags with icons). Access shows a requested → approved → usable pipeline.
- Every screen opens with an **Action needed** bar that answers that role's question.

## What is simulated

Teams and Outlook delivery and replies, the Doc agent, skill challenge submissions, score history before 14 Oct, on-time readiness history, and the task, 1:1 and challenge evidence that makes Eva's score complete. All of these are marked "Simulated" in the UI.
