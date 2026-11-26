"use client";
// C5 Validation queue (TL): proposed level per scope with its evidence and score impact.
// Confirm, or override with a mandatory reason. Validating every core scope releases the score cap.
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronDown, ChevronRight, Timer, Lock, Scale, CalendarPlus } from "lucide-react";
import { useAxon } from "@/lib/store";
import type { Outcome, ScopeLevel, Validation } from "@/lib/types";
import { computeScore, scoreWith, tlGate } from "@/lib/score";
import { employee, project, userName } from "@/lib/selectors";
import { daysAgo, fmtDate, addDays } from "@/lib/dates";
import { TODAY } from "@/lib/seed";
import { EVIDENCE_KIND_LABEL, LEVELS, LEVEL_HINT, LEVEL_LABEL, OUTCOME_LABEL } from "@/lib/labels";
import { AiChip, Avatar, BandTag, Card, Empty, GateChip, HumanChip, LevelTag, Needed, PageHead, ScoreRing, Stat, Toast, SimTag } from "@/components/ui";

const confirmLevel = (p: ScopeLevel): ScopeLevel => (p === "independent" ? "validated" : p);

export default function ValidationQueue() {
  const { db, user } = useAxon();
  const [toast, setToast] = useState<string | null>(null);
  if (!user) return null;
  const mine = db.validations.filter((v) => v.tl_id === user.id);
  const caseIds = Array.from(new Set(mine.map((v) => v.case_id)));
  const pending = mine.filter((v) => !v.decided_level);
  const oldest = pending.map((v) => db.evidence.filter((e) => v.evidence_ids.includes(e.id)).map((e) => e.occurred_at).sort().reverse()[0] ?? TODAY).sort()[0];
  const capped = caseIds.filter((id) => !tlGate(db, id).passed).length;
  const conflictCase = caseIds.find((id) => db.flags.some((f) => f.case_id === id && f.type === "conflict" && f.status === "open"));

  return (
    <>
      <PageHead title="Validation queue" question="Whose readiness do I need to validate?" />
      {pending.length ? (
        <Needed action={conflictCase ? <a className="btn" href={`#case-${conflictCase}`}><Scale size={15} />Resolve conflict</a> : undefined}>
          {pending.length} scope{pending.length > 1 ? "s wait" : " waits"} for your sign-off.{conflictCase ? ` ${employee(db, db.cases.find((c) => c.id === conflictCase)!).name}'s Line Manager and your last review disagree; your decision settles it.` : ""}
        </Needed>
      ) : <Needed>Nothing waits for you. New proposals arrive when evidence changes.</Needed>}

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Stat k="Pending validations" v={pending.length} icon={<ShieldCheck size={14} />} d={(() => { const n = caseIds.filter((id) => pending.some((v) => v.case_id === id)).length; return `Across ${n} ${n === 1 ? "person" : "people"}`; })()} />
        <Stat k="Waiting since" v={oldest ? daysAgo(oldest) : 0} unit="days" icon={<Timer size={14} />} d={oldest ? `Oldest evidence ${fmtDate(oldest)}` : "No pending items"} />
        <Stat k="Waiting on the TL gate" v={capped} icon={<Lock size={14} />} d={`Scores cannot pass ${db.config.tl_cap} until core scopes are validated`} />
      </div>

      {caseIds.length === 0 ? <Card><Empty title="No validations assigned to you">When the Readiness Assessor proposes levels for your people, they appear here.</Empty></Card> : (
        <div className="stack">{caseIds.map((id) => <CaseBlock key={id} caseId={id} onToast={setToast} />)}</div>
      )}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}

function CaseBlock({ caseId, onToast }: { caseId: string; onToast: (m: string) => void }) {
  const { db, setOutcome } = useAxon();
  const c = db.cases.find((x) => x.id === caseId)!;
  const emp = employee(db, c);
  const s = computeScore(db, caseId);
  const gate = tlGate(db, caseId);
  const vals = db.validations.filter((v) => v.case_id === caseId);
  const coreScopes = db.scopes.filter((x) => x.case_id === caseId && x.is_core);
  const allCoreDecided = coreScopes.every((sc) => vals.some((v) => v.scope_id === sc.id && v.decided_level));
  const conflict = db.flags.find((f) => f.case_id === caseId && f.type === "conflict" && f.status === "open");
  const claims = conflict ? conflict.evidence_ids.map((id) => db.evidence.find((e) => e.id === id)!).filter(Boolean) : [];

  return (
    <section className="card" id={`case-${caseId}`}>
      <div className="card-pad split" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 20, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        <div className="row gap16">
          <Avatar name={emp.name} lg dark />
          <div>
            <div className="row gap6"><Link href={`/cases/${caseId}`} style={{ fontSize: 18, fontWeight: 720, color: "var(--midnight)" }}>{emp.name}</Link><span className="mono muted">{caseId}</span></div>
            <div className="small ink2">{project(db, c.project_id)?.name} · {c.role} · started {fmtDate(c.start_date)} · expected ready {fmtDate(c.expected_ready_date)}</div>
            <div className="row gap6" style={{ marginTop: 6 }}><GateChip passed={gate.passed} validated={gate.validated} total={gate.total} />{c.outcome && <HumanChip who={userName(db, c.tl_id) ?? "TL"} label={`Outcome ${OUTCOME_LABEL[c.outcome]}`} />}</div>
          </div>
        </div>
        <div className="row gap16 score-side">
          <div style={{ textAlign: "right" }}><BandTag band={s.band} provisional={s.provisional} /><div className="xs muted" style={{ marginTop: 4 }}>Completeness {s.completeness}%</div></div>
          <ScoreRing score={s.score} band={s.band} size={96} capped={s.capped} provisional={s.provisional} />
        </div>
      </div>

      {conflict && claims.length === 2 && (
        <div style={{ padding: "14px 20px", background: "rgba(180,33,58,.04)", borderBottom: "1px solid var(--line)" }}>
          <div className="row gap6 small strong" style={{ color: "var(--sev-high)" }}><Scale size={14} />Conflict to settle</div>
          <div className="grid g2" style={{ marginTop: 8 }}>
            {claims.map((e) => (
              <div key={e.id} className="claim small"><b>{e.author_label}</b> · {fmtDate(e.occurred_at)} · claims <b>{e.claimed_status!.replace(/_/g, " ")}</b><div className="ink2" style={{ marginTop: 4 }}>{e.summary}</div><div className="src">{e.source_ref}</div></div>
            ))}
          </div>
          <div className="xs muted" style={{ marginTop: 8 }}>Your decisions below are logged with your name and resolve the conflict. The Line Manager gets a Teams note (simulated).</div>
        </div>
      )}

      <div style={{ padding: "4px 20px 8px" }}>
        <table className="table stack-sm">
          <thead><tr><th>Scope</th><th>Now</th><th>Proposal</th><th>Score impact</th><th className="tight">Decision</th></tr></thead>
          <tbody>
            {vals.map((v) => <ScopeRow key={v.id} v={v} onToast={onToast} />)}
          </tbody>
        </table>
      </div>

      {!c.outcome && <OutcomePanel caseId={caseId} ready={allCoreDecided} onSet={(o, r) => { setOutcome(caseId, o, r); onToast(`Outcome set: ${OUTCOME_LABEL[o]}`); }} />}
    </section>
  );
}

function ScopeRow({ v, onToast }: { v: Validation; onToast: (m: string) => void }) {
  const { db, decideValidation } = useAxon();
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState(false);
  const [lvl, setLvl] = useState<ScopeLevel>(v.proposed_level);
  const [reason, setReason] = useState("");
  const scope = db.scopes.find((s) => s.id === v.scope_id)!;
  const ev = db.evidence.filter((e) => v.evidence_ids.includes(e.id));
  const target = override ? lvl : confirmLevel(v.proposed_level);
  const before = computeScore(db, v.case_id);
  const after = scoreWith(db, v.case_id, (d) => { const s = d.scopes.find((x) => x.id === v.scope_id)!; s.level = target; });
  const gAfter = (() => { const copy = structuredClone(db); copy.scopes.find((x) => x.id === v.scope_id)!.level = target; return tlGate(copy, v.case_id); })();

  if (v.decided_level) {
    return (
      <tr>
        <td className="cell-head"><div className="strong small">{scope.name}</div><div className="xs muted">{scope.is_core ? "Core" : "Non-core"}</div></td>
        <td data-label="Now"><LevelTag level={scope.level} /></td>
        <td data-label="Proposal" className="small muted">AI proposed {LEVEL_LABEL[v.proposed_level]}</td>
        <td data-label="Impact" className="small">{v.reason ? <span className="ink2">“{v.reason}”</span> : <span className="muted">Confirmed as proposed</span>}</td>
        <td data-label="Decision"><HumanChip who={userName(db, v.decided_by) ?? "TL"} when={v.decided_at} label={v.decided_level === "validated" ? "Validated" : v.decided_level === confirmLevel(v.proposed_level) ? "Confirmed" : "Overridden"} /></td>
      </tr>
    );
  }

  return (
    <>
      <tr>
        <td className="cell-head" style={{ maxWidth: 260 }}>
          <button className="linkbtn row gap4" style={{ color: "var(--ink)", fontWeight: 650, textAlign: "left" }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{scope.name}</button>
          <div className="xs muted" style={{ marginLeft: 18 }}>{scope.is_core ? "Core" : "Non-core"} · {ev.length} evidence item{ev.length === 1 ? "" : "s"}</div>
        </td>
        <td data-label="Now"><LevelTag level={scope.level} /></td>
        <td data-label="Proposal" style={{ maxWidth: 300 }}>
          <div className="row gap6"><AiChip label={`AI: ${LEVEL_LABEL[v.proposed_level]}`} /><span className="xs muted">{Math.round(v.confidence * 100)}% confidence</span></div>
          <div className="xs ink2" style={{ marginTop: 4 }}>{v.rationale}</div>
        </td>
        <td data-label="Score impact" className="small nowrap">
          <div>Score <b className="num">{before.score ?? "–"}</b> → <b className="num">{after.score ?? "–"}</b></div>
          <div className="xs muted">Core validated {gAfter.validated}/{gAfter.total}{gAfter.passed ? " · cap lifts" : ""}</div>
        </td>
        <td data-label="Decision">
          {!override ? (
            <div className="row gap6">
              <button className="btn sm primary" onClick={() => { decideValidation(v.id, confirmLevel(v.proposed_level), null); onToast(`${scope.name}: ${LEVEL_LABEL[confirmLevel(v.proposed_level)]}`); }} title={v.proposed_level === "independent" ? "Independent work confirmed by the TL becomes Validated" : undefined}>
                {v.proposed_level === "independent" ? "Validate" : `Confirm ${LEVEL_LABEL[v.proposed_level]}`}</button>
              <button className="btn sm" onClick={() => setOverride(true)}>Override</button>
            </div>
          ) : <span className="xs muted">Choose below</span>}
        </td>
      </tr>
      {override && (
        <tr className="row-full"><td colSpan={5} style={{ background: "rgba(89,53,175,.04)" }}>
          <div className="grid split-sm" style={{ gridTemplateColumns: "220px 1fr auto", gap: 12, alignItems: "end" }}>
            <div className="field"><label>Level</label>
              <select className="select" value={lvl} onChange={(e) => setLvl(e.target.value as ScopeLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
              <span className="hint">{LEVEL_HINT[lvl]}</span></div>
            <div className="field"><label>Reason (required, logged)</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What did you observe that the proposal missed?" />
              <span className="hint">&nbsp;</span></div>
            <div className="row gap6" style={{ paddingBottom: 22 }}>
              <button className="btn sm" onClick={() => setOverride(false)}>Cancel</button>
              <button className="btn sm primary" disabled={reason.trim().length < 5} onClick={() => { decideValidation(v.id, lvl, reason.trim()); onToast(`${scope.name}: ${LEVEL_LABEL[lvl]} (override)`); }}>Save override</button>
            </div>
          </div>
        </td></tr>
      )}
      {open && (
        <tr className="row-full"><td colSpan={5} style={{ background: "rgba(255,255,255,.5)" }}>
          <div className="list">
            {ev.map((e) => (
              <div key={e.id} className="li small">
                <span className="tag neutral xs">{EVIDENCE_KIND_LABEL[e.kind]}</span>
                <div style={{ flex: 1 }}>{e.summary}<div className="xs muted">{e.author_label} · {fmtDate(e.occurred_at)} {e.support_level && `· ${LEVEL_LABEL[e.support_level]}`}</div><div className="src">{e.source_ref}</div></div>
                {e.simulated && <SimTag />}
              </div>
            ))}
          </div>
        </td></tr>
      )}
    </>
  );
}

function OutcomePanel({ caseId, ready, onSet }: { caseId: string; ready: boolean; onSet: (o: Outcome, reason: string) => void }) {
  const { db } = useAxon();
  const gate = tlGate(db, caseId);
  const suggested: Outcome = gate.passed ? "ready" : gate.validated > 0 ? "ready_with_support" : "partially_ready";
  const [picked, setO] = useState<Outcome | null>(null);
  const o = picked ?? suggested;
  const [reason, setReason] = useState("");
  const [kt, setKt] = useState(addDays(TODAY, 10));
  const remaining = db.scopes.filter((s) => s.case_id === caseId && s.is_core && s.level !== "validated");
  const preview = scoreWith(db, caseId, (d) => { d.evidence.push({ ...d.evidence[0], id: "preview", case_id: caseId, kind: "tl_review", occurred_at: "2099-01-01", value_0_100: o === "ready" ? 100 : o === "ready_with_support" ? 75 : 50, status: "ok" }); });
  const blocked = o === "ready" && !gate.passed;

  return (
    <div style={{ padding: "16px 20px 20px", borderTop: "1px solid var(--line)", background: ready ? "rgba(89,53,175,.04)" : undefined }}>
      <div className="row between wrap" style={{ marginBottom: 10 }}>
        <div><div className="strong" style={{ color: "var(--midnight)" }}>Set the readiness outcome</div>
          <div className="small muted">{ready ? "Every core scope has your decision." : "Decide each core scope first."} Only you can set this; AXON never sets Ready on its own.</div></div>
        <div className="small">Score after: <b className="num">{preview.score}</b> <BandTag band={preview.band} /></div>
      </div>
      <div className="grid split-md" style={{ gridTemplateColumns: "auto 1fr 180px auto", gap: 12, alignItems: "end" }}>
        <div className="field"><label>Outcome</label>
          <div className="seg">{(["ready", "ready_with_support", "partially_ready"] as Outcome[]).map((x) => <button key={x} className={o === x ? "on" : ""} onClick={() => setO(x)} disabled={!ready}>{OUTCOME_LABEL[x]}</button>)}</div></div>
        <div className="field"><label>Reason (required)</label><input className="input" disabled={!ready} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={remaining.length ? `e.g. Standard work validated; ${remaining.map((s) => s.name.replace("Complex scenario: ", "")).join(" and ")} still to cover` : "What you observed"} /></div>
        <div className="field"><label><CalendarPlus size={12} /> Remaining KT by</label><input className="input" type="date" disabled={!ready || !remaining.length} value={kt} onChange={(e) => setKt(e.target.value)} /></div>
        <button className="btn primary" disabled={!ready || reason.trim().length < 5 || blocked} onClick={() => onSet(o, `${reason.trim()}${remaining.length && o !== "ready" ? ` Remaining KT scheduled by ${fmtDate(kt)}.` : ""}`)}>Set outcome</button>
      </div>
      {blocked && <div className="err" style={{ marginTop: 8 }}>Ready needs every core scope validated ({gate.validated}/{gate.total}).</div>}
    </div>
  );
}
