// Mock agent outputs used until the backend routes are live.
// Each function has the same input/output shape as its route in the brief (Part 5).
// The UI marks every result "Proposed by AI". Nothing here decides anything.
import type { Action, Case, Channel, Db, Evidence, Flag, RequirementType, ClientRequirement } from "./types";
import { TODAY } from "./seed";
import { addDays, fmtDate } from "./dates";

const uname = (db: Db, id: string | null) => db.users.find((u) => u.id === id)?.name ?? null;
const emp = (db: Db, c: Case) => uname(db, c.employee_id) ?? c.id;

type Draft = Pick<Action, "channel" | "recipient" | "recipient_role" | "subject" | "body" | "due_at" | "evidence_ids">;

/** A4 Next-Action Drafter. POST /api/agents/draft-action {flag_id} -> actions row (status draft) */
export function draftAction(db: Db, flag: Flag): Draft {
  const c = db.cases.find((x) => x.id === flag.case_id)!;
  const name = emp(db, c);
  const tl = uname(db, c.tl_id);
  const lm = uname(db, c.line_manager_id);
  const due = addDays(TODAY, flag.severity === "high" ? 2 : 3);
  const base = { due_at: due, evidence_ids: flag.evidence_ids };
  const teams = (recipient: string, recipient_role: string, body: string): Draft => ({ ...base, channel: "teams", recipient, recipient_role, body });
  const outlook = (recipient: string, recipient_role: string, subject: string, body: string): Draft => ({ ...base, channel: "outlook", recipient, recipient_role, subject, body });

  switch (flag.id) {
    case "fl-conflict-ONB-005":
      return teams(tl ?? "Tech Lead", "Tech Lead",
        `Hi ${tl?.split(" ")[0] ?? ""}, Luca reports Eva's onboarding as closed, while your 13 Oct review says Ready with Support with 2 complex scenarios left. Could you confirm her level per scope in the validation queue by ${fmt(due)}? It takes one click per scope.`);
    case "fl-access_delay-ONB-002":
      return outlook("Orion Portal application owner", "Application owner", "Approval needed: Orion Portal for Leo Marin (NIM-482)",
        `Hello, Leo Marin's Orion Portal account was requested on 7 Oct for project NIM-482 and is waiting for your approval. Could you approve it by ${fmt(due)}? He cannot start his Nimbus work without it.`);
    case "fl-access_delay-ONB-007":
      return outlook("Nova network team", "Access owner", "Nova NOC dashboard access for Iris Moon",
        `Hello, Iris Moon's NOC dashboard access was expected the week after 20 Sep and has not been confirmed. Could you confirm whether it is active, or give a date, by ${fmt(due)}?`);
    case "fl-unanswered-ONB-009":
      return teams("Dario Wells", "Technical Manager",
        `Hi Dario, a reminder about the 8 Oct request: please confirm Lina West's project role, KT owner and expected readiness date. Replying here is enough.`);
    case "fl-missing_info-ONB-009":
      return teams("Dario Wells", "Technical Manager", `Hi Dario, Lina West started KT on 9 Oct with no project, role or KT owner on record. Which project is she on?`);
    case "fl-stale-ONB-007":
      return teams(lm ?? "Line Manager", "Line Manager", `Hi ${lm?.split(" ")[0] ?? ""}, Iris Moon's tracker has not changed since 20 Sep. Where is she now in KT, and does she have NOC dashboard access?`);
    case "fl-missing_info-ONB-008":
      return teams(lm ?? "Line Manager", "Line Manager", `Hi ${lm?.split(" ")[0] ?? ""}, Theo Park is marked Blocked with no reason. What is blocking him, and who can remove it?`);
    case "fl-date_mismatch-ONB-006":
      return outlook("Hana Brooks", "HR Partner", "Noah Lane started on 12 Oct: please confirm setup",
        `Hi Hana, Noah Lane started on 12 Oct but his case is still in Pre-onboarding. Can you confirm his project, role, Line Manager and TL so his setup can start? His Atlas docs are referenced at /Team/Operations/Onboarding.`);
    case "fl-missing_info-ONB-004":
      return outlook("Hana Brooks", "HR Partner", "Aron Bell (Helios): line manager and TL missing",
        `Hi Hana, Aron Bell moved to Helios on 1 Oct but has no Line Manager or TL on record. Who should own his onboarding?`);
    case "fl-missing_info-ONB-003":
    case "fl-stale-ONB-003":
      return outlook("Hana Brooks", "HR Partner", "Nora Venn: project and role not recorded",
        `Hi Hana, Nora Venn started on 28 Sep with no project or role on record, and the tracker has not changed since 30 Sep. Which project and role is she joining?`);
    case "fl-missing_info-ONB-010":
      return teams(tl ?? "Tech Lead", "Tech Lead", `Hi ${tl?.split(" ")[0] ?? ""}, Owen Hart reports he works alone on standard activities but needs help on exceptions and production changes. Could you set a date for his readiness review?`);
    case "fl-missing_info-ONB-001":
      return teams(lm ?? "Line Manager", "Line Manager", `Hi ${lm?.split(" ")[0] ?? ""}, Mila Rowan has no access record and no expected readiness date. Which systems does she use, and when should she be ready?`);
  }
  const channel: Channel = /access|hr/i.test(flag.owner_label) ? "outlook" : "teams";
  const who = flag.owner_label.replace(/\s*\(.*\)$/, "");
  return channel === "outlook"
    ? outlook(who, flag.owner_label.match(/\((.*)\)/)?.[1] ?? "Owner", `${name}: ${flag.type.replace("_", " ")}`, `Hello, ${flag.detail} Could you look at this for ${name} by ${fmt(due)}?`)
    : teams(who, flag.owner_label.match(/\((.*)\)/)?.[1] ?? "Owner", `Hi, ${flag.detail} Could you look at this for ${name} by ${fmt(due)}?`);
}

function fmt(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(day)} ${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)]}`;
}

/** A5 Reply Listener (simulated). POST /api/webhooks/inbound -> actions.status = answered, then A1 writes evidence. */
export const REPLIES: Record<string, { summary: string; apply: (db: Db, c: Case) => void }> = {
  "fl-unanswered-ONB-009": {
    summary: "Lina joins Nimbus as Integration Analyst. KT owner Petra Lind. Expected readiness 20 Nov.",
    apply: (db, c) => { c.project_id = "p-nimbus"; c.role = "Integration Analyst"; c.path_id = "pa-nimbus"; c.tl_id = "u-tl-nimbus"; c.expected_ready_date = "2026-11-20"; },
  },
  "fl-missing_info-ONB-009": {
    summary: "Lina joins Nimbus as Integration Analyst. KT owner Petra Lind. Expected readiness 20 Nov.",
    apply: (db, c) => { c.project_id = "p-nimbus"; c.role = "Integration Analyst"; c.path_id = "pa-nimbus"; c.tl_id = "u-tl-nimbus"; c.expected_ready_date = "2026-11-20"; },
  },
  "fl-access_delay-ONB-002": {
    summary: "Orion Portal approved for Leo Marin. Helix Service Desk is now assigned to Access Support, ETA 16 Oct.",
    apply: (db) => {
      const o = db.access_items.find((x) => x.id === "ac-002-2"); if (o) { o.state = "approved"; o.updated_at = TODAY; o.note = "Approved by app owner on 14 Oct. Waiting for Leo to confirm it works."; }
      const h = db.access_items.find((x) => x.id === "ac-002-3"); if (h) { h.owner_label = "Access Support"; h.next_followup_at = "2026-10-16"; h.note = "Owner assigned. ETA 16 Oct."; }
    },
  },
  "fl-access_delay-ONB-007": {
    summary: "NOC dashboard access was activated on 25 Sep; Iris confirmed she uses it.",
    apply: (db) => { const x = db.access_items.find((i) => i.id === "ac-007-1"); if (x) { x.state = "usable"; x.updated_at = TODAY; x.note = "Confirmed usable by the Nova network team reply."; } },
  },
  "fl-stale-ONB-007": {
    summary: "Iris does monitoring shifts with support and has NOC access. Change requests start next week.",
    apply: (db, c) => {
      c.tracker_updated_at = TODAY;
      const s = db.scopes.find((x) => x.id === "s-007-1"); if (s) { s.level = "supported"; s.level_updated_at = TODAY; }
      const x = db.access_items.find((i) => i.id === "ac-007-1"); if (x) { x.state = "usable"; x.updated_at = TODAY; }
    },
  },
  "fl-missing_info-ONB-008": {
    summary: "Theo is blocked on write access to the Pulse warehouse. The data platform team owns it.",
    apply: (db, c) => {
      db.access_items.push({ id: "ac-008-3", case_id: c.id, system: "Pulse warehouse (write)", state: "requested", owner_label: "Data platform team", requested_at: "2026-10-08", updated_at: TODAY, next_followup_at: "2026-10-16", note: "Reason for the Blocked status, from the LM reply." });
    },
  },
  "fl-date_mismatch-ONB-006": {
    summary: "Noah's project, role, LM and TL are confirmed. Setup can start.",
    apply: (db, c) => { c.stage = "setup"; c.tracker_updated_at = TODAY; db.stage_history.push({ case_id: c.id, stage: "setup", entered_at: TODAY }); },
  },
  "fl-missing_info-ONB-004": {
    summary: "Aron's line manager is Tomas Reed. TL is still to be named by the Helios project.",
    apply: (db, c) => { c.line_manager_id = "u-lm-tomas"; },
  },
  "fl-missing_info-ONB-003": {
    summary: "Nora joins Pulse as Data Analyst from 16 Oct. TL Ivo Sand.",
    apply: (db, c) => { c.project_id = "p-pulse"; c.role = "Data Analyst"; c.path_id = "pa-pulse"; c.tl_id = "u-tl-pulse"; c.tracker_updated_at = TODAY; c.expected_ready_date = "2026-11-27"; },
  },
  "fl-stale-ONB-003": {
    summary: "Nora joins Pulse as Data Analyst from 16 Oct. TL Ivo Sand.",
    apply: (db, c) => { c.project_id = "p-pulse"; c.role = "Data Analyst"; c.path_id = "pa-pulse"; c.tl_id = "u-tl-pulse"; c.tracker_updated_at = TODAY; c.expected_ready_date = "2026-11-27"; },
  },
  "fl-missing_info-ONB-010": {
    summary: "Final readiness review booked for 22 Oct.",
    apply: (db, c) => { c.expected_ready_date = "2026-10-22"; },
  },
  "fl-missing_info-ONB-001": {
    summary: "Mila uses Aurora ticketing and the knowledge base; both work. Expected readiness 6 Nov.",
    apply: (db, c) => {
      c.expected_ready_date = "2026-11-06";
      db.access_items.push({ id: "ac-001-1", case_id: c.id, system: "Aurora ticketing", state: "usable", owner_label: "Access Support", requested_at: "2026-10-01", updated_at: TODAY, next_followup_at: null, note: "Confirmed in LM reply." });
      db.access_items.push({ id: "ac-001-2", case_id: c.id, system: "Aurora knowledge base", state: "usable", owner_label: "Access Support", requested_at: "2026-10-01", updated_at: TODAY, next_followup_at: null, note: "Confirmed in LM reply." });
    },
  },
  "fl-conflict-ONB-005": {
    summary: "Ada will confirm Eva's levels in AXON today.",
    apply: () => {},
  },
};

export function replyEvidence(action: Action, summary: string): Evidence {
  return {
    id: `ev-reply-${action.id}`, case_id: action.case_id, scope_id: null, kind: action.channel === "teams" ? "email" : "email",
    author_role: "pmo", author_label: `${action.recipient} (${action.recipient_role})`, author_id: null,
    source_ref: `${action.thread_ref}#reply`, occurred_at: TODAY, summary, claimed_status: null, support_level: null, reworked: false,
    value_0_100: null, disputed: false, extracted_by: "ai", status: "ok",
  };
}

/** A6 1:1 Scorer (mock rubric: understanding, communication, confidence, issues raised). */
export function scoreOneOnOne(note: string, raterPast: number[]): number {
  const t = note.toLowerCase();
  let s = 6;
  if (/(clear|confident|independent|alone|good questions|solid)/.test(t)) s += 1.5;
  if (/(struggl|unsure|not sure|confus|lost|stuck|block)/.test(t)) s -= 2;
  if (/(escalat|asked|raised)/.test(t)) s += 0.5;
  if (/(late|missed|no detail|waiting)/.test(t)) s -= 1;
  if (t.length < 25) s -= 0.5;
  // calibrate toward the rater's own scale after 3 ratings
  if (raterPast.length >= 3) { const m = raterPast.reduce((a, b) => a + b, 0) / raterPast.length; s = s * 0.7 + m * 0.3; }
  return Math.max(1, Math.min(10, Math.round(s * 2) / 2));
}

/** A10 Requirements Assistant (mock parser). POST /api/agents/requirements/parse {text} */
export function parseRequirement(db: Db, text: string): { cards: Omit<ClientRequirement, "id" | "status" | "submitted_by" | "approved_by" | "reason" | "created_at">[]; question: string | null } {
  const t = text.toLowerCase();
  const project = db.projects.find((p) => t.includes(p.name.toLowerCase()) || t.includes(p.code.toLowerCase()));
  if (!project) return { cards: [], question: "Which project does this requirement apply to?" };
  const affected = db.cases.filter((c) => c.project_id === project.id && c.stage !== "closed").map((c) => c.id);
  const date = parseDate(text);
  const names = affected.map((id) => emp(db, db.cases.find((c) => c.id === id)!)).join(", ") || "no active cases";
  const cards: ReturnType<typeof parseRequirement>["cards"] = [];
  const training = text.match(/(?:finish|complete|pass)\s+(?:the\s+)?([A-Za-z0-9/ \-]+?)\s+(?:training|course|certification)/i);
  if (training || /training|course|certif/i.test(t)) {
    const name = training?.[1]?.trim() ?? "Client training";
    cards.push({ client_id: project.client_id ?? null, project_id: project.id, path_id: null, type: "skill", detail: `Complete ${name} training`, effective_date: date, affected_case_ids: affected,
      impact: `${affected.length} case${affected.length === 1 ? " gets" : "s get"} a new core scope "${name} training" (${names}). Scores are capped again until the TL validates it.` });
  }
  const acc = text.match(/(\b[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*\b)\s+access/);
  if (acc || /access/i.test(t)) {
    const sys = acc?.[1] ?? "Required system";
    cards.push({ client_id: project.client_id ?? null, project_id: project.id, path_id: null, type: "access", detail: `${sys} access must be usable`, effective_date: date, affected_case_ids: affected,
      impact: `${affected.length} case${affected.length === 1 ? " gets" : "s get"} a ${sys} access item (requested).` });
  }
  if (date) {
    const earlier = affected.filter((id) => { const c = db.cases.find((x) => x.id === id)!; return !c.expected_ready_date || c.expected_ready_date > date; });
    cards.push({ client_id: project.client_id ?? null, project_id: project.id, path_id: null, type: "deadline", detail: `Ready by ${fmtDate(date, true)}`, effective_date: date, affected_case_ids: affected,
      impact: earlier.length ? `${earlier.length} expected readiness date${earlier.length === 1 ? "" : "s"} move earlier to ${fmtDate(date, true)}.` : "No expected dates change." });
  }
  if (!cards.length) {
    cards.push({ client_id: project.client_id ?? null, project_id: project.id, path_id: null, type: "compliance" as RequirementType, detail: text.slice(0, 140), effective_date: date, affected_case_ids: affected,
      impact: `${affected.length} case${affected.length === 1 ? " gets" : "s get"} a client requirement flag for the TL to review.` });
  }
  return { cards, question: null };
}

function parseDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}))?/i);
  if (!m) return null;
  const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase()) + 1;
  const year = m[3] ? Number(m[3]) : mon >= 10 ? 2026 : 2027;
  return `${year}-${String(mon).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
