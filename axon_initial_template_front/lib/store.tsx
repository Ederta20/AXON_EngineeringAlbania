"use client";
// Client-side demo store. Every action below names the API route the backend will serve.
// Swap the body of each action for a fetch() to that route; components do not change.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Action, CauseClass, ClientRequirement, Config, Db, Flag, Outcome, ScopeLevel, User, WeightProfile } from "./types";
import { makeSeed, TODAY } from "./seed";
import { runRules } from "./rules";
import { draftAction as a4, parseRequirement as a10, REPLIES, replyEvidence, scoreOneOnOne } from "./agents";
import { addDays } from "./dates";
import { diffDb, isEmpty } from "./dbdiff";

// "api": load from and save to Supabase through /api/db. "mock" (default): everything stays in this browser.
const API = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";

const KEY = "axon-demo-v3";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

type ReqCard = ReturnType<typeof a10>["cards"][number];
/** What an agent button needs to tell the person: did the real model answer, and does a human need to check it. */
export type AgentRun = { source: "ai" | "mock"; status: "ok" | "needs_review"; count?: number; conflicts?: string[] };

interface Store {
  db: Db;
  user: User | null;
  ready: boolean;
  aiLive: boolean;                                             // true in api mode: agent buttons call the real model
  login(userId: string): void;
  logout(): void;
  reset(): void;
  // Core flow
  draftNextAction(flagId: string): Promise<string>;           // POST /api/agents/draft-action
  editAction(id: string, patch: Partial<Action>): void;        // PATCH /api/actions/:id
  approveAction(id: string): void;                             // PATCH /api/actions/:id {status: approved} -> outbox -> sent
  rejectAction(id: string, reason: string): void;              // PATCH /api/actions/:id {status: rejected}
  simulateReply(actionId: string): void;                       // POST /api/ingest/replies (mock connector)
  assignOwner(flagIds: string[], ownerLabel: string): void;     // PATCH /api/flags/:id
  confirmCause(flagId: string, cause: CauseClass): void;       // PATCH /api/flags/:id
  analyzeFlag(flagId: string): Promise<AgentRun>;              // POST /api/agents/analyze-flag (A2)
  assessReadiness(caseId: string): Promise<AgentRun>;          // POST /api/agents/assess (A3)
  generateChallenges(skillId: string): Promise<AgentRun>;      // POST /api/agents/challenges (A7)
  improvePath(pathId: string): Promise<AgentRun>;              // POST /api/agents/improve (A9)
  writeReport(audience: "management" | "digest"): Promise<{ source: "ai" | "mock"; subject: string; text: string }>; // POST /api/agents/report (A8)
  resolveFlag(flagId: string, reason: string): void;           // PATCH /api/flags/:id {status: resolved}
  decideValidation(id: string, level: ScopeLevel, reason: string | null): void; // POST /api/validations/:id/decide
  setOutcome(caseId: string, outcome: Outcome, reason: string): void;          // POST /api/cases/:id/outcome
  // Core-lite
  submitOneOnOne(caseId: string, rating: number, note: string): Promise<{ ai: number; gap: boolean }>; // POST /api/agents/score-1on1
  submitCheckin(caseId: string, perScope: Record<string, number>, kt: number | null, doc: number | null, note: string): void; // POST /api/checkins
  confirmAccess(itemId: string): void;                         // PATCH /api/access/:id {state: usable}
  reportAccessProblem(itemId: string, note: string): void;     // POST /api/flags (access)
  reportBlocker(caseId: string, text: string): void;           // POST /api/flags (blocked)
  toggleStep(key: string): void;
  parseRequirements(text: string): Promise<{ cards: ReqCard[]; question: string | null }>; // POST /api/agents/requirements/parse
  submitRequirements(cards: ReqCard[]): void;                  // POST /api/requirements/:id/submit
  decideRequirement(id: string, approve: boolean, reason: string): void; // PATCH /api/requirements/:id (Admin)
  // Extra
  updateProfile(id: string, patch: Partial<WeightProfile>): void;
  updateConfig(patch: Partial<Config>): void;
  approveChallenge(id: string): void;
  decideSuggestion(id: string, approve: boolean): void;
}

const Ctx = createContext<Store | null>(null);

function fresh(): Db { return runRules(makeSeed()); }

export function AxonProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db>(fresh);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const dbRef = useRef(db);
  dbRef.current = db;

  const pending = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const loadFromServer = useCallback(async () => {
    const r = await fetch("/api/db", { cache: "no-store" });
    if (!r.ok) throw new Error(`GET /api/db ${r.status}`);
    const d = (await r.json()) as Db;
    dbRef.current = d;
    setDb(d);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (!API && s.db) setDb(s.db); if (s.userId) setUserId(s.userId); }
    } catch { /* storage can be unavailable */ }
    if (!API) { setReady(true); return; }
    loadFromServer().catch((e) => console.error("AXON: could not load from the database", e)).finally(() => setReady(true));
  }, [loadFromServer]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(API ? { userId } : { db, userId })); } catch { /* ignore */ }
  }, [db, userId, ready]);

  /** api mode: send only the rows an action changed; the server writes them, reruns the rules and returns the new state. */
  const sync = useCallback((prev: Db, next: Db) => {
    const changes = diffDb(prev, next);
    if (isEmpty(changes)) return;
    pending.current++;
    queue.current = queue.current.then(async () => {
      try {
        const r = await fetch("/api/db", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(changes) });
        if (!r.ok) throw new Error(await r.text());
        const server = (await r.json()) as Db;
        if (--pending.current === 0) { dbRef.current = server; setDb(server); } // a newer local change is still on its way
      } catch (e) {
        pending.current--;
        console.error("AXON: could not save to the database", e);
        if (typeof window !== "undefined") window.alert("Could not save this change to the database. Check the terminal running npm run dev.");
      }
    });
  }, []);

  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db.users, userId]);
  const actor = user ? `${user.name} (${user.title})` : "system";

  const commit = useCallback((fn: (d: Db) => void, audit?: { action: string; entity: string; entity_id: string; payload?: Record<string, unknown>; actor?: string }) => {
    const prev = dbRef.current;
    const d = structuredClone(prev);
    fn(d);
    runRules(d);
    if (audit) d.audit_log.unshift({ id: uid("au"), actor: audit.actor ?? actor, at: new Date().toISOString(), ...audit });
    dbRef.current = d; // so back-to-back actions build on each other
    setDb(d);
    if (API) sync(prev, d);
  }, [actor, sync]);

  const store: Store = {
    db, user, ready, aiLive: API,
    login: (id) => setUserId(id),
    logout: () => setUserId(null),
    reset: () => { if (API) loadFromServer().catch((e) => console.error(e)); else setDb(fresh()); }, // api mode: reload from the database

    async draftNextAction(flagId) {
      if (API) { // A4 runs on the server (real model when configured) and saves the draft
        const a = await postAgent<{ id: string }>("/api/agents/draft-action", { flag_id: flagId });
        await loadFromServer();
        return a.id;
      }
      await wait(900); // model latency, so the "drafting" state is visible
      const flag = dbRef.current.flags.find((f) => f.id === flagId)!;
      const draft = a4(dbRef.current, flag);
      const id = uid("act");
      commit((d) => {
        d.actions.push({ id, case_id: flag.case_id, flag_id: flagId, status: "draft", approved_by: null, created_at: TODAY,
          thread_ref: `${draft.channel}://${flag.case_id}/thread/${id}`, ...draft });
      }, { actor: "agent:A4 Next-Action Drafter", action: "draft_action", entity: "actions", entity_id: id, payload: { flag_id: flagId } });
      return id;
    },
    editAction(id, patch) { commit((d) => { Object.assign(d.actions.find((a) => a.id === id)!, patch); }); },
    approveAction(id) {
      commit((d) => { const a = d.actions.find((x) => x.id === id)!; a.status = "approved"; a.approved_by = user?.id ?? null; },
        { action: "approve_action", entity: "actions", entity_id: id });
      setTimeout(() => commit((d) => { const a = d.actions.find((x) => x.id === id); if (a && a.status === "approved") { a.status = "sent"; a.sent_at = TODAY; } },
        { actor: "connector:mock-mail", action: "delivered", entity: "actions", entity_id: id }), 1400);
    },
    rejectAction(id, reason) {
      commit((d) => { const a = d.actions.find((x) => x.id === id)!; a.status = "rejected"; a.reject_reason = reason; }, { action: "reject_action", entity: "actions", entity_id: id, payload: { reason } });
    },
    simulateReply(actionId) {
      if (API) { // A5 on the server: answered, A1 turns the reply into evidence, the pipeline follows
        postAgent("/api/agents/reply", { action_id: actionId }).then(() => loadFromServer()).catch((e) => console.error("AXON: reply failed", e));
        return;
      }
      commit((d) => {
        const a = d.actions.find((x) => x.id === actionId)!;
        const c = d.cases.find((x) => x.id === a.case_id)!;
        const r = REPLIES[a.flag_id] ?? { summary: "Owner acknowledged and will follow up.", apply: () => {} };
        a.status = "answered"; a.answered_at = TODAY; a.reply_summary = r.summary;
        const e = replyEvidence(a, r.summary);
        if (!d.evidence.some((x) => x.id === e.id)) d.evidence.push(e);
        r.apply(d, c);
        // manual flags tied to this action close with the reply
        const f = d.flags.find((x) => x.id === a.flag_id);
        if (f && f.origin === "manual") { f.status = "resolved"; f.resolved_at = TODAY; f.resolution = `Answered: ${r.summary}`; }
      }, { actor: "agent:A5 Reply Listener", action: "reply_ingested", entity: "actions", entity_id: actionId });
    },
    assignOwner(flagIds, ownerLabel) {
      commit((d) => { for (const id of flagIds) { const f = d.flags.find((x) => x.id === id); if (f) { f.owner_label = ownerLabel; f.owner_id = d.users.find((u) => ownerLabel.startsWith(u.name))?.id ?? null; } } },
        { action: "assign_owner", entity: "flags", entity_id: flagIds.join(","), payload: { owner: ownerLabel } });
    },
    confirmCause(flagId, cause) { commit((d) => { const f = d.flags.find((x) => x.id === flagId)!; f.cause_class = cause; f.cause_confirmed = true; }, { action: "confirm_cause", entity: "flags", entity_id: flagId, payload: { cause } }); },
    resolveFlag(flagId, reason) {
      commit((d) => { const f = d.flags.find((x) => x.id === flagId)!; f.status = "resolved"; f.resolved_at = TODAY; f.resolution = reason; d.resolved_flag_ids.push(flagId); },
        { action: "resolve_flag", entity: "flags", entity_id: flagId, payload: { reason } });
    },
    decideValidation(id, level, reason) {
      commit((d) => {
        const v = d.validations.find((x) => x.id === id)!;
        v.decided_level = level; v.reason = reason; v.decided_at = TODAY; v.decided_by = user?.id ?? null;
        const s = d.scopes.find((x) => x.id === v.scope_id)!; s.level = level; s.level_updated_at = TODAY;
      }, { action: "validate_scope", entity: "validations", entity_id: id, payload: { level, reason } });
    },
    setOutcome(caseId, outcome, reason) {
      commit((d) => {
        const c = d.cases.find((x) => x.id === caseId)!;
        c.outcome = outcome; c.stage = "outcome"; c.tracker_updated_at = TODAY;
        d.stage_history.push({ case_id: caseId, stage: "outcome", entered_at: TODAY });
        const tl = d.users.find((u) => u.id === c.tl_id);
        d.evidence.push({ id: uid("ev-tl"), case_id: caseId, scope_id: null, kind: "tl_review", author_role: "tl", author_label: `${tl?.name ?? "TL"} (Tech Lead)`, author_id: c.tl_id,
          source_ref: `axon://validation/${caseId}/${TODAY}`, occurred_at: TODAY, summary: `Outcome set to ${outcome.replace(/_/g, " ")} in AXON. ${reason}`,
          claimed_status: outcome, support_level: null, reworked: false, value_0_100: outcome === "ready" ? 100 : outcome === "ready_with_support" ? 75 : 50,
          disputed: false, extracted_by: "manual", status: "ok" });
        for (const e of d.evidence) if (e.case_id === caseId && e.disputed) e.disputed = false;
      }, { action: "set_outcome", entity: "cases", entity_id: caseId, payload: { outcome, reason } });
    },

    async analyzeFlag(flagId) {
      if (API) { // A2 proposes cause, owner and a sentence on the server; the PMO still confirms
        const r = await postAgent<AgentRun>("/api/agents/analyze-flag", { flag_id: flagId });
        await loadFromServer();
        return r;
      }
      await wait(700); // mock mode: the seeded proposal is already shown
      return { source: "mock", status: "ok" };
    },

    async assessReadiness(caseId) {
      if (API) { // A3 proposes a level per scope on the server; only the TL decides
        const r = await postAgent<{ source: "ai" | "mock"; status: "ok" | "needs_review"; scopes: unknown[]; conflicts: string[] }>("/api/agents/assess", { case_id: caseId });
        await loadFromServer();
        return { source: r.source, status: r.status, count: r.scopes.length, conflicts: r.conflicts };
      }
      await wait(900); // mock mode: the seeded proposals are already shown
      return { source: "mock", status: "ok" };
    },

    async generateChallenges(skillId) {
      if (API) { // A7 drafts 2-3 challenges; the TL approves them before anyone sees them
        const r = await postAgent<{ source: "ai" | "mock"; status: "ok" | "needs_review"; challenges: unknown[] }>("/api/agents/challenges", { skill_id: skillId });
        await loadFromServer();
        return { source: r.source, status: r.status, count: r.challenges.length };
      }
      await wait(700); return { source: "mock", status: "ok" };
    },

    async improvePath(pathId) {
      if (API) { // A9: benchmark from completed cases (in code) + template changes from confirmed causes; the PMO approves
        const r = await postAgent<{ source: "ai" | "mock"; status: "ok" | "needs_review"; suggestions: { status: string }[] }>("/api/agents/improve", { path_id: pathId });
        await loadFromServer();
        return { source: r.source, status: r.status, count: r.suggestions.filter((x) => x.status === "proposed").length };
      }
      await wait(700); return { source: "mock", status: "ok" };
    },

    async writeReport(audience) {
      if (API) return postAgent<{ source: "ai" | "mock"; subject: string; text: string }>("/api/agents/report", { audience, user_id: user?.id }); // A8: numbers from code, words from the model
      await wait(700);
      return { source: "mock", subject: "AXON report (demo mode)", text: "Live reports need NEXT_PUBLIC_DATA_SOURCE=api. The numbers on this page are the same ones the report would use." };
    },

    async submitOneOnOne(caseId, rating, note) {
      if (API) { // A6 scores the note on the server and saves the 1:1 (and a rating_gap flag if needed)
        const r = await postAgent<{ rating_ai: number; gap: boolean }>("/api/agents/score-1on1", { case_id: caseId, rater_id: user?.id ?? "u-pmo", rating_human: rating, note });
        await loadFromServer();
        return { ai: r.rating_ai, gap: r.gap };
      }
      await wait(700);
      const past = dbRef.current.one_on_ones.filter((o) => o.rater_id === user?.id).map((o) => o.rating_human);
      const ai = scoreOneOnOne(note, past);
      const gap = Math.abs(ai - rating) > dbRef.current.config.rating_gap;
      const id = uid("oo");
      commit((d) => {
        d.one_on_ones.push({ id, case_id: caseId, rater_id: user?.id ?? "u-pmo", rating_human: rating, rating_ai: ai, note, held_at: TODAY });
        if (gap) d.flags.push(manualFlag(d, caseId, "rating_gap", `1:1 rated ${rating}/10 by ${user?.name}; AI scored the note ${ai}/10. Gap over ${d.config.rating_gap} points.`, "low", `${user?.name ?? "Rater"}`, [id]));
      }, { action: "one_on_one", entity: "one_on_ones", entity_id: id, payload: { rating, ai } });
      return { ai, gap };
    },
    submitCheckin(caseId, perScope, kt, doc, note) {
      commit((d) => {
        const entries = Object.entries(perScope);
        const avgSelf = entries.length ? Math.round(entries.reduce((a, [, v]) => a + v, 0) / entries.length) : 5;
        d.checkins.push({ id: uid("ci"), case_id: caseId, scope_id: null, self_score: avgSelf, kt_rating: kt, doc_rating: doc, note, at: TODAY });
        d.evidence.push({ id: uid("ev-ci"), case_id: caseId, scope_id: null, kind: "checkin", author_role: "employee", author_label: `${user?.name ?? "Employee"} (self)`, author_id: user?.id ?? null,
          source_ref: `axon://checkin/${caseId}/${TODAY}`, occurred_at: TODAY, summary: `Weekly check-in. Self-assessment ${entries.map(([sid, v]) => `${d.scopes.find((s) => s.id === sid)?.name}: ${v}/10`).join("; ")}.${note ? " Note: " + note : ""}`,
          claimed_status: null, support_level: null, reworked: false, value_0_100: null, disputed: false, extracted_by: "manual", status: "ok" });
      }, { action: "checkin", entity: "checkins", entity_id: caseId });
    },
    confirmAccess(itemId) {
      commit((d) => { const x = d.access_items.find((i) => i.id === itemId)!; x.state = "usable"; x.updated_at = TODAY; x.note = "Confirmed working by the employee."; x.next_followup_at = null;
        for (const f of d.flags) if (f.origin === "manual" && f.type === "access_delay" && f.evidence_ids.includes(itemId) && f.status === "open") { f.status = "resolved"; f.resolved_at = TODAY; f.resolution = "Employee confirmed access works."; } },
        { action: "access_usable", entity: "access_items", entity_id: itemId });
    },
    reportAccessProblem(itemId, note) {
      commit((d) => {
        const x = d.access_items.find((i) => i.id === itemId)!;
        if (x.state === "usable") x.state = "approved";
        x.note = `Employee reports it does not work: ${note || "no detail"}`; x.updated_at = TODAY; x.next_followup_at = addDays(TODAY, 1);
        d.flags.push(manualFlag(d, x.case_id, "access_delay", `${x.system} does not work for the employee (${note || "no detail given"}).`, "high", x.owner_label, [itemId]));
      }, { action: "access_problem", entity: "access_items", entity_id: itemId, payload: { note } });
    },
    reportBlocker(caseId, text) {
      commit((d) => {
        const e = { id: uid("ev-bl"), case_id: caseId, scope_id: null, kind: "checkin" as const, author_role: "employee" as const, author_label: `${user?.name ?? "Employee"} (self)`, author_id: user?.id ?? null,
          source_ref: `axon://blocker/${caseId}/${TODAY}`, occurred_at: TODAY, summary: `Reported blocker: ${text}`, claimed_status: null, support_level: null, reworked: false, value_0_100: null, disputed: false, extracted_by: "manual", status: "ok" as const };
        d.evidence.push(e);
        const c = d.cases.find((x) => x.id === caseId)!;
        const lm = d.users.find((u) => u.id === c.line_manager_id);
        d.flags.push(manualFlag(d, caseId, "blocked", `Employee reported: ${text}`, "high", lm ? `${lm.name} (LM)` : "PMO", [e.id]));
      }, { action: "report_blocker", entity: "cases", entity_id: caseId, payload: { text } });
    },
    toggleStep(key) { commit((d) => { d.done_steps = d.done_steps.includes(key) ? d.done_steps.filter((k) => k !== key) : [...d.done_steps, key]; }); },

    async parseRequirements(text) {
      if (API) return postAgent<{ cards: ReqCard[]; question: string | null }>("/api/agents/requirements/parse", { text, user_id: user?.id }); // A10 on the server
      await wait(1000); return a10(dbRef.current, text);
    },
    submitRequirements(cards) {
      commit((d) => { for (const c of cards) d.client_requirements.unshift({ ...c, id: uid("req"), status: "submitted", submitted_by: user?.id ?? null, approved_by: null, reason: null, created_at: TODAY }); },
        { action: "submit_requirements", entity: "client_requirements", entity_id: String(cards.length) });
    },
    decideRequirement(id, approve, reason) {
      commit((d) => {
        const r = d.client_requirements.find((x) => x.id === id)!;
        r.status = approve ? "approved" : "rejected"; r.approved_by = user?.id ?? null; r.reason = reason;
        if (!approve) return;
        applyRequirement(d, r);
      }, { action: approve ? "approve_requirement" : "reject_requirement", entity: "client_requirements", entity_id: id, payload: { reason } });
    },

    updateProfile(id, patch) { commit((d) => { const p = d.weight_profiles.find((x) => x.id === id)!; Object.assign(p, patch); p.version += 1; }, { action: "update_profile", entity: "weight_profiles", entity_id: id, payload: patch as Record<string, unknown> }); },
    updateConfig(patch) { commit((d) => { Object.assign(d.config, patch); }, { action: "update_config", entity: "config", entity_id: "config", payload: patch as Record<string, unknown> }); },
    approveChallenge(id) { commit((d) => { d.challenges.find((x) => x.id === id)!.approved_by = user?.id ?? null; }, { action: "approve_challenge", entity: "challenges", entity_id: id }); },
    decideSuggestion(id, approve) { commit((d) => { const s = d.path_suggestions.find((x) => x.id === id)!; s.status = approve ? "approved" : "rejected"; s.approved_by = user?.id ?? null; }, { action: "decide_suggestion", entity: "path_suggestions", entity_id: id }); },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** POST to an agent route (api mode). Agent routes save their own proposals. */
async function postAgent<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

function manualFlag(d: Db, caseId: string, type: Flag["type"], detail: string, severity: Flag["severity"], owner: string, evidence_ids: string[]): Flag {
  return { id: uid(`fl-${type}-${caseId}`), case_id: caseId, type, severity, cause_class: null, cause_confirmed: false, owner_id: d.users.find((u) => owner.startsWith(u.name))?.id ?? null,
    owner_label: owner, suggested_owner: null, raised_at: TODAY, due_at: addDays(TODAY, severity === "high" ? 1 : 3), status: "open", evidence_ids, detail, root_cause: null, origin: "manual" };
}

/** Rules (no AI) that apply an approved client requirement to every affected case. */
function applyRequirement(d: Db, r: ClientRequirement) {
  for (const caseId of r.affected_case_ids) {
    const c = d.cases.find((x) => x.id === caseId);
    if (!c) continue;
    if (r.type === "skill") d.scopes.push({ id: uid("s"), case_id: caseId, name: r.detail.replace(/^Complete /, ""), is_core: true, level: "not_started", level_updated_at: TODAY, added_by_requirement: r.id });
    if (r.type === "access") d.access_items.push({ id: uid("ac"), case_id: caseId, system: r.detail.replace(/ access must be usable$/, ""), state: "requested", owner_label: "Access Support", requested_at: TODAY, updated_at: TODAY, next_followup_at: addDays(TODAY, 3), note: "Added by an approved client requirement." });
    if (r.type === "deadline" && r.effective_date && (!c.expected_ready_date || c.expected_ready_date > r.effective_date)) c.expected_ready_date = r.effective_date;
    const tl = d.users.find((u) => u.id === c.tl_id);
    d.flags.push(manualFlag(d, caseId, "client_requirement", `New client requirement: ${r.detail}.`, "medium", tl ? `${tl.name} (TL)` : "PMO", []));
  }
}

export function useAxon() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useAxon outside AxonProvider");
  return s;
}
