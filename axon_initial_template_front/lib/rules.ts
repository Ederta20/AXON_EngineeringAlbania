// Rules engine. Deterministic, no AI. Mirrors the SQL rules in the brief (Part 3):
// rule_stale, rule_missing_info, rule_date_mismatch, rule_access_delay, rule_unanswered, rule_conflict.
// Runs on load and after every write. Rule flags that stop matching resolve on their own.
import type { CauseClass, Db, Flag, FlagType, Severity } from "./types";
import { TODAY } from "./seed";
import { addDays, daysAgo, daysBetween, fmtDate } from "./dates";

type Hit = {
  case_id: string; type: FlagType; rule: string; detail: string; raised_at: string;
  evidence_ids: string[]; severity: Severity; owner_label: string; owner_id?: string | null; key?: string;
};

// A2 Root-Cause Analyst output for the seed flags (cached AI proposals; the PMO confirms them on C2).
export const A2_CACHE: Record<string, { cause: CauseClass; sentence: string; owner: string }> = {
  "fl-access_delay-ONB-002": { cause: "external", sentence: "Two systems wait on owners outside the team: the Orion Portal app owner has not approved, and nobody owns Helix provisioning.", owner: "Access Support" },
  "fl-missing_info-ONB-003": { cause: "process", sentence: "HR recorded the start without a project or role, so no TL or KT plan could be assigned.", owner: "Hana Brooks (HR)" },
  "fl-stale-ONB-003": { cause: "process", sentence: "No owner updates the tracker while the case has no project.", owner: "Tomas Reed (LM)" },
  "fl-missing_info-ONB-004": { cause: "compliance", sentence: "The reallocation moved Aron to Helios without naming a line manager or TL.", owner: "Hana Brooks (HR)" },
  "fl-conflict-ONB-005": { cause: "process", sentence: "The Line Manager judged from local work only; the TL review covers the two complex scenarios still open. Only the TL can decide readiness.", owner: "Ada Quinn (TL)" },
  "fl-date_mismatch-ONB-006": { cause: "process", sentence: "Start date passed but the setup gate was never signed off, so the case stayed in Pre-onboarding.", owner: "Hana Brooks (HR)" },
  "fl-stale-ONB-007": { cause: "compliance", sentence: "No weekly update since shadowing started; the access promised for the next week was never confirmed.", owner: "Rita Cole (LM)" },
  "fl-access_delay-ONB-007": { cause: "external", sentence: "The NOC dashboard request has no follow-up date and no confirmation from the Nova network team.", owner: "Nova network team" },
  "fl-missing_info-ONB-008": { cause: "individual", sentence: "The tracker says Blocked but nobody recorded why or who owns it, so nobody can act.", owner: "Mark Hale (LM)" },
  "fl-unanswered-ONB-009": { cause: "process", sentence: "The request went to the Technical Manager by email with no deadline he acknowledged.", owner: "Dario Wells (TM)" },
  "fl-missing_info-ONB-009": { cause: "process", sentence: "The reallocation has no project, role or KT owner, so KT started without a plan.", owner: "Dario Wells (TM)" },
  "fl-missing_info-ONB-010": { cause: "process", sentence: "The self-report says partially ready, but no TL review or readiness review date exists.", owner: "Rhea Vance (TL)" },
  "fl-missing_info-ONB-001": { cause: "compliance", sentence: "Access was never recorded and no expected readiness date was set at setup.", owner: "Jon Vale (LM)" },
};

const uname = (db: Db, id: string | null) => db.users.find((u) => u.id === id)?.name;

export function detect(db: Db): Hit[] {
  const hits: Hit[] = [];
  const { stale_days, escalate_days } = db.config;
  const open = db.cases.filter((c) => c.stage !== "closed");

  for (const c of open) {
    const ev = db.evidence.filter((e) => e.case_id === c.id && e.status !== "needs_review"); // unreviewed AI matches never raise or clear flags
    const lastActivity = [c.tracker_updated_at, ...ev.filter((e) => e.kind !== "email" || e.author_role !== "pmo").map((e) => e.occurred_at)]
      .sort().reverse()[0];

    // rule_stale
    const idle = daysAgo(lastActivity);
    if (idle > stale_days) {
      hits.push({ case_id: c.id, type: "stale", rule: "rule_stale", raised_at: addDays(lastActivity, stale_days + 1),
        detail: `No update for ${idle} days (last update ${fmtDate(lastActivity)}). Threshold is ${stale_days} days.`,
        evidence_ids: ev.filter((e) => e.occurred_at === lastActivity).map((e) => e.id), severity: idle > 20 ? "high" : "medium",
        owner_label: uname(db, c.line_manager_id) ? `${uname(db, c.line_manager_id)} (LM)` : "PMO", owner_id: c.line_manager_id });
    }

    // rule_missing_info
    const missing = [
      !c.project_id && "project", !c.role && "exact role", !c.line_manager_id && "line manager", !c.tl_id && "TL / KT owner",
      !c.expected_ready_date && "expected readiness date",
      c.stage !== "pre_onboarding" && !db.access_items.some((x) => x.case_id === c.id) && "access record",
      c.tracker_status === "Blocked" && !ev.some((e) => e.kind !== "tracker" && /block/i.test(e.summary)) && "blocker reason and owner",
    ].filter(Boolean) as string[];
    if (c.id === "ONB-010" && !ev.some((e) => e.kind === "tl_review")) missing.push("TL validation of the self-report");
    if (missing.length) {
      const blocking = missing.some((m) => ["project", "TL / KT owner", "blocker reason and owner"].includes(m));
      hits.push({ case_id: c.id, type: "missing_info", rule: "rule_missing_info", raised_at: c.tracker_status === "Blocked" ? c.tracker_updated_at : c.start_date > TODAY ? TODAY : c.start_date,
        detail: `Missing: ${missing.join(", ")}.`, evidence_ids: ev.filter((e) => e.kind === "tracker").map((e) => e.id),
        severity: blocking ? "high" : "medium",
        owner_label: !c.project_id || !c.line_manager_id ? "Hana Brooks (HR)" : uname(db, c.tl_id) && missing.includes("TL validation of the self-report") ? `${uname(db, c.tl_id)} (TL)` : uname(db, c.line_manager_id) ? `${uname(db, c.line_manager_id)} (LM)` : "PMO" });
    }

    // rule_date_mismatch
    if (c.stage === "pre_onboarding" && c.start_date <= TODAY && c.project_id) {
      hits.push({ case_id: c.id, type: "date_mismatch", rule: "rule_date_mismatch", raised_at: c.start_date,
        detail: `Started on ${fmtDate(c.start_date)} but still in Pre-onboarding (${daysAgo(c.start_date)} days).`,
        evidence_ids: ev.filter((e) => e.kind === "tracker").map((e) => e.id), severity: "medium", owner_label: "Hana Brooks (HR)", owner_id: "u-hr" });
    }

    // rule_access_delay
    const late = db.access_items.filter((x) => x.case_id === c.id && x.state !== "usable" && daysAgo(x.requested_at) > escalate_days);
    if (late.length) {
      const first = late.map((x) => x.requested_at).sort()[0];
      hits.push({ case_id: c.id, type: "access_delay", rule: "rule_access_delay", raised_at: addDays(first, escalate_days + 1),
        detail: `${late.length} system${late.length > 1 ? "s" : ""} not usable ${daysAgo(first)} days after request: ${late.map((x) => `${x.system} (${x.state})`).join(", ")}.`,
        evidence_ids: ev.filter((e) => e.kind === "email").map((e) => e.id), severity: "high", owner_label: late[0].owner_label === "Unassigned" ? "Access Support" : late[0].owner_label });
    }

    // rule_conflict: same case and scope, different claimed status, different authors, within 7 days, not yet decided by the TL
    const claims = ev.filter((e) => e.claimed_status && ["tl_review", "email", "checkin"].includes(e.kind) && e.author_role !== "pmo");
    for (let i = 0; i < claims.length; i++) for (let j = i + 1; j < claims.length; j++) {
      const x = claims[i], y = claims[j];
      if ((x.scope_id ?? "") !== (y.scope_id ?? "") || x.claimed_status === y.claimed_status || x.author_role === y.author_role) continue;
      if (Math.abs(daysBetween(x.occurred_at, y.occurred_at)) > 7) continue;
      const later = x.occurred_at > y.occurred_at ? x.occurred_at : y.occurred_at;
      const decided = db.validations.some((v) => v.case_id === c.id && v.decided_at && v.decided_at >= later) || c.outcome;
      if (decided) continue;
      hits.push({ case_id: c.id, type: "conflict", rule: "rule_conflict", raised_at: later,
        detail: `${x.author_label} says "${label(x.claimed_status!)}"; ${y.author_label} says "${label(y.claimed_status!)}".`,
        evidence_ids: [x.id, y.id], severity: "high", owner_label: uname(db, c.tl_id) ? `${uname(db, c.tl_id)} (TL)` : "TL", owner_id: c.tl_id });
    }
  }

  // rule_unanswered
  for (const a of db.actions.filter((a) => a.status === "sent" && a.due_at < TODAY)) {
    hits.push({ case_id: a.case_id, type: "unanswered", rule: "rule_unanswered", raised_at: a.due_at,
      detail: `${a.recipient} (${a.recipient_role}) has not answered since ${fmtDate(a.sent_at ?? a.created_at)}: "${a.subject ?? a.body.slice(0, 60)}".`,
      evidence_ids: a.evidence_ids, severity: "medium", owner_label: `${a.recipient} (${a.recipient_role})`, key: a.id });
  }
  return hits;
}

function label(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
}

/** Reconcile rule hits with stored flags. Keeps people's edits (owner, cause), resolves flags that no longer match. */
export function runRules(db: Db): Db {
  const hits = detect(db);
  const seen = new Set<string>();
  for (const h of hits) {
    const id = `fl-${h.type}-${h.case_id}${h.type === "unanswered" || h.type === "conflict" ? "" : ""}`;
    seen.add(id);
    const existing = db.flags.find((f) => f.id === id);
    if (existing) {
      existing.detail = h.detail;
      existing.evidence_ids = h.evidence_ids;
      if (existing.status === "resolved" && !db.resolved_flag_ids.includes(id)) { existing.status = "open"; existing.resolved_at = null; existing.resolution = null; }
      continue;
    }
    if (db.resolved_flag_ids.includes(id)) continue;
    const a2 = A2_CACHE[id];
    const f: Flag = {
      id, case_id: h.case_id, type: h.type, severity: h.severity, cause_class: a2?.cause ?? null, cause_confirmed: false,
      owner_id: h.owner_id ?? null, owner_label: h.owner_label, suggested_owner: a2?.owner ?? null,
      raised_at: h.raised_at, due_at: addDays(h.raised_at, h.severity === "high" ? 2 : 3), status: "open",
      evidence_ids: h.evidence_ids, detail: h.detail, root_cause: a2?.sentence ?? null, origin: "rule", rule: h.rule,
    };
    db.flags.push(f);
  }
  for (const f of db.flags) {
    if (f.origin === "rule" && f.status === "open" && !seen.has(f.id)) {
      f.status = "resolved"; f.resolved_at = TODAY; f.resolution = "Rule no longer matches after new evidence.";
    }
  }
  return db;
}

export const FLAG_ORDER: FlagType[] = ["conflict", "access_delay", "blocked", "unanswered", "missing_info", "stale", "date_mismatch", "at_risk", "client_requirement", "rating_gap"];
