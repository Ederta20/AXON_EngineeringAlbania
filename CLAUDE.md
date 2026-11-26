# AXON: Claude instructions

The source of truth is `spec/AXON_Project_Brief.pdf` (30 pages, Nov 26 2026, @arjola).
Put the PDF at that path in the repo. Read it before answering any question about scope, screens, metrics, schema, agents or build order. If this file and the PDF disagree, the PDF wins; say so and flag the difference.

## How to analyze the brief

1. Read the whole PDF first (use the `pdf-reading` approach if available). Page 18 holds an architecture diagram that text extraction misses, so open it as an image.
2. Answer from the brief, citing the part and page, for example "Part 3, p.15". Never invent screens, tables, agents or thresholds that are not in it.
3. For any check, consistency review or gap analysis, cross-check these against each other:
   - Part 1 screens vs Part 3 tables and views (does every screen have its data?)
   - Part 2 score components vs the `v_score_components` view and `weight_profiles` columns
   - Part 3 seed flags (10 cases) vs the SQL rules (do the rules raise exactly the expected flags?)
   - Part 5 agents vs Part 4 architecture boundary (which run in AXON, which in the connector layer?)
   - Part 7 requirement checklist vs where each item is actually covered
   - Counts: 18 screens (6 Core, 6 Core-lite, 6 Extra, plus X7), 26 tables (14/7/5), 10 agents (A1-A10 plus the Doc agent)
4. When asked for an opinion, separate what the brief says from your own assessment. Mark open questions as "to confirm".
5. Respect the tiering. Core must work end to end before Core-lite or Extra is touched. Never recommend trading off a Core step.

## Key facts (digest, verify against the PDF)

**Principle:** AXON removes work from every actor. People act in Teams and Outlook; AXON reads those as evidence and sends back one action per message, with one batched daily digest per person.

**Core flow (7 steps):** Detect, Triage, Trace, Score, Act, Validate, Update.

**Screens:** Core C1-C6 (login, flags board, case detail, next-action drawer, validation queue, My path). Core-lite L1-L5 and X7. Extras X1-X6.

**States:**
- Case stage: Pre-onboarding, Setup, In KT, Awaiting validation, Outcome, Closed
- Scope level: Not started, Shadowing, Supported, Independent, Validated
- Flags: Blocked, Stale, Conflict, At risk, Unanswered request, Missing info, Access delay
- Status is computed from evidence, never stored as truth.

**Score (0-100):**
- Default weights: Work 35, TL review 30, 1:1 15, Challenges 15, Self 5
- Formula: weighted sum over the components that have data, divided by the sum of those weights
- Completeness = share of weight that has data; under 60% the score is provisional
- TL gate: capped at 84 until the TL validates every core scope
- Bands: 0-39 Not ready, 40-64 Partially Ready, 65-84 Ready with Support, 85-100 Ready

**Stack:** Next.js on Vercel, Supabase Postgres with row-level security. Gap rules are plain SQL with no AI. The app clock is fixed at 2026-10-14. Thresholds: stale after 7 days, escalate after 3.

**AI rules:**
- Every AI output is a proposal, and a person approves it.
- Agents validate JSON with zod, retry once, then save the row as `needs_review`.
- Numbers come from SQL, never from the LLM.
- Missing facts stay empty and become flags; the agent never guesses.
- AXON never accesses mailboxes or chats. Connectors on the company side send structured evidence through `/api/ingest/*`.

**Simulated in the demo:** Teams and Outlook, the Doc agent, and seeded task evidence for Eva.

**Demo:** 10 minutes. Eva goes from flag to evidence to score to action to TL validation, with Leo's access flag on the board.

**Deadline:** the last commit is before 22:00. The README, a PR with reviewers and the email are in Part 7 and the build order.

## Output conventions

- Be concise. Use tables for comparisons and checklists.
- Quote at most a short phrase from the PDF; otherwise paraphrase and cite the page.
- If a request needs a decision the brief leaves open (for example the TL is empty for ONB-004 and ONB-009 on purpose), say so instead of filling it in.
