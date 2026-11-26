"use client";
// C3 Case detail: one screen, panels by role.
// Employee: no 1:1 scores. HR: start info only. Management: score and flags only.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Mail, ClipboardList, ShieldCheck, Wrench, MessageCircle, Users, Puzzle, FileText, Wand2, ExternalLink, FolderOpen,
  AlertCircle, CheckCircle2, Scale, Star,
} from "lucide-react";
import { useAxon } from "@/lib/store";
import type { EvidenceKind, Role, ScoreComponent } from "@/lib/types";
import { computeScore, tlGate } from "@/lib/score";
import { employee, openFlags, project, userName, benchmarkStatus } from "@/lib/selectors";
import { daysAgo, fmtDate } from "@/lib/dates";
import { CAUSE_LABEL, EVIDENCE_KIND_LABEL, LEVEL_LABEL, MOVEMENT_LABEL, OUTCOME_LABEL, STAGE_LABEL } from "@/lib/labels";
import { TODAY } from "@/lib/seed";
import {
  AccessPipe, AiChip, Avatar, BandTag, Card, Empty, FlagTag, GateChip, HumanChip, LevelStepper, LevelTag, Needed, ScoreRing, SevTag, SimTag, StageTag, Toast,
} from "@/components/ui";
import { NextActionDrawer } from "@/components/NextActionDrawer";
import { DocLink } from "@/components/DocLink";
import { OneOnOneModal } from "@/components/OneOnOneModal";
import { LineChart } from "@/components/charts";

const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
const KIND_ICON: Record<EvidenceKind, typeof Mail> = { email: Mail, tracker: ClipboardList, tl_review: ShieldCheck, task: Wrench, checkin: MessageCircle, one_on_one: Users, challenge: Puzzle };
const COMPONENT_KINDS: Record<ScoreComponent["key"], EvidenceKind[]> = { work: ["task"], tl: ["tl_review"], oneonone_human: ["one_on_one"], oneonone_ai: ["one_on_one"], challenge: ["challenge"], self: ["checkin"] };

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const { db, user } = useAxon();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [focus, setFocus] = useState<ScoreComponent["key"] | null>(null);
  const [rate, setRate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const c = db.cases.find((x) => x.id === id);
  const score = useMemo(() => (c ? computeScore(db, c.id) : null), [db, c]);
  if (!c || !score || !user) return <Empty title="Case not found" />;

  const role: Role = user.role;
  const emp = employee(db, c);
  const proj = project(db, c.project_id);
  const flags = openFlags(db, c.id);
  const gate = tlGate(db, c.id);
  const show = {
    score: role !== "hr",
    breakdown: !["hr", "mgmt"].includes(role),
    evidence: !["hr", "mgmt"].includes(role),
    oneOnOne: !["employee", "hr", "mgmt"].includes(role),
    scopes: !["hr", "mgmt"].includes(role),
    access: !["mgmt"].includes(role),
    actions: role === "pmo",
    rate: role === "tl" || role === "lm",
  };
  const conflict = flags.find((f) => f.type === "conflict");
  const tlName = userName(db, c.tl_id);
  const highlight = q.get("flag");
  const pendingVal = db.validations.filter((v) => v.case_id === c.id && !v.decided_level);

  const needed = (() => {
    if (role === "pmo" && flags[0]) {
      const has = db.actions.some((a) => a.flag_id === flags[0].id && a.status !== "rejected");
      return { text: has ? `Follow-up on "${flags[0].detail}" is in progress.` : `${flags.length} open flag${flags.length > 1 ? "s" : ""}. Draft a follow-up for the ${flags[0].severity}-severity one first.`, cta: !has ? <button className="btn" onClick={() => setDrawer(flags[0].id)}><Wand2 size={15} />Draft next action</button> : <button className="btn" onClick={() => setDrawer(flags[0].id)}>Open follow-up</button> };
    }
    if (role === "tl" && pendingVal.length) return { text: `${pendingVal.length} scope${pendingVal.length > 1 ? "s" : ""} wait for your validation. The score stays capped at ${db.config.tl_cap} until every core scope is validated.`, cta: <Link className="btn" href="/validation">Open validation queue</Link> };
    if (role === "hr") { const mi = flags.find((f) => f.type === "missing_info" || f.type === "date_mismatch"); return { text: mi ? `Start information is incomplete: ${mi.detail}` : "Start information is complete.", cta: null }; }
    if (role === "lm" || role === "tl") return { text: flags.length ? `${flags.length} open flag${flags.length > 1 ? "s" : ""} on ${emp.name.split(" ")[0]}. Rate your last 1:1 if it isn't logged yet.` : `No open flags. Rate your last 1:1 if it isn't logged yet.`, cta: <button className="btn" onClick={() => setRate(true)}><Star size={15} />Rate 1:1</button> };
    if (role === "mgmt") return { text: flags.length ? `${flags.filter((f) => f.severity === "high").length} high-severity flags on this onboarding.` : "On track: no open flags.", cta: null };
    return { text: flags.length ? `${flags.length} open flag${flags.length > 1 ? "s" : ""}.` : "On track: no open flags.", cta: null };
  })();

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link href={role === "pmo" ? "/flags" : role === "tl" ? "/validation" : "/people"} className="btn sm ghost"><ArrowLeft size={14} />Back</Link>
      </div>
      <Needed action={needed.cta}>{needed.text}</Needed>

      {/* Header */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad split" style={{ display: "grid", gridTemplateColumns: show.score ? "minmax(0,1fr) auto" : "1fr", gap: 24, alignItems: "center" }}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="row gap16 top">
              <Avatar name={emp.name} lg dark />
              <div style={{ flex: 1 }}>
                <div className="row gap6 wrap"><h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em", color: "var(--midnight)" }}>{emp.name}</h1></div>
                <div className="ink2" style={{ marginTop: 2 }}>
                  {proj ? `${proj.name} (${proj.code})` : <span className="missing"><AlertCircle size={13} />No project</span>} · {c.role ?? <span className="missing">No role</span>} · {MOVEMENT_LABEL[c.movement_type]}
                </div>
              </div>
            </div>
            <div className="row wrap gap16">
              <div><div className="xs muted">Stage (computed)</div><StageTag stage={c.stage} outcome={c.outcome} /></div>
              <div><div className="xs muted">Tracker says</div><span className="tag outline">{c.tracker_status}</span> <span className="xs muted">updated {fmtDate(c.tracker_updated_at)}</span></div>
              {norm(c.tracker_status) !== norm(c.stage === "outcome" && c.outcome ? OUTCOME_LABEL[c.outcome] : STAGE_LABEL[c.stage]) && (
                <div className="small" style={{ alignSelf: "flex-end", color: "var(--sev-med)", fontWeight: 600 }}>Tracker and evidence disagree</div>
              )}
            </div>
            <dl className="kv">
              <dt>Start date</dt><dd>{fmtDate(c.start_date, true)} <span className="muted small">({daysAgo(c.start_date)} days ago)</span></dd>
              <dt>Expected ready</dt><dd>{c.expected_ready_date ? fmtDate(c.expected_ready_date, true) : <span className="missing"><AlertCircle size={13} />Not set</span>}</dd>
              <dt>Line Manager</dt><dd>{userName(db, c.line_manager_id) ?? <span className="missing"><AlertCircle size={13} />Not assigned</span>}</dd>
              <dt>Tech Lead / KT owner</dt><dd>{tlName ?? <span className="missing"><AlertCircle size={13} />Not assigned</span>}</dd>
              {show.score && <><dt>Benchmark</dt><dd>{benchmarkStatus(db, c).label}{benchmarkStatus(db, c).provisional && <span className="muted small"> (provisional benchmark)</span>}</dd></>}
            </dl>
          </div>
          {show.score && (
            <div className="row gap16 wrap score-side" style={{ alignItems: "center" }}>
              <ScoreRing score={score.score} band={score.band} capped={score.capped} provisional={score.provisional} size={140} />
              <div className="stack" style={{ gap: 8, minWidth: 0, flex: "1 1 200px" }}>
                <div><div className="xs muted">Readiness band</div><BandTag band={score.band} provisional={score.provisional} /></div>
                <div><div className="xs muted">Completeness</div>
                  <div className="row gap6"><div className="bar" style={{ width: 120 }}><span style={{ width: `${score.completeness}%` }} /></div><span className="num small strong">{score.completeness}%</span></div>
                  {score.provisional && <div className="xs" style={{ color: "var(--sev-med)", fontWeight: 600 }}>Under {db.config.provisional_below}%: score is provisional</div>}</div>
                <GateChip passed={gate.passed} validated={gate.validated} total={gate.total} />
                {score.capped && <div className="xs muted">Raw {score.raw}, capped at {db.config.tl_cap} until the TL validates.</div>}
                {show.breakdown && <a href="#breakdown" className="small">Why this score?</a>}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid g-case">
        <div className="stack">
          {/* Open flags */}
          <Card title="Open flags" sub="Raised by rules. Root cause proposed by AI; owners confirmed by the PMO." pad={false}>
            {flags.length === 0 ? <Empty title="No open flags" icon={<CheckCircle2 size={18} />}>This onboarding is on track.</Empty> : (
              <div className="list" style={{ padding: "6px 20px 8px" }}>
                {flags.map((f) => {
                  const act = db.actions.filter((a) => a.flag_id === f.id && a.status !== "rejected").sort((a, b) => b.id.localeCompare(a.id))[0];
                  return (
                    <div key={f.id} className="li" style={highlight === f.id ? { background: "rgba(255,91,0,.05)", margin: "0 -20px", padding: "12px 20px" } : undefined}>
                      <div style={{ flex: 1 }}>
                        <div className="row gap6 wrap"><FlagTag type={f.type} severity={f.severity} /><SevTag s={f.severity} />{f.cause_class && <span className="tag outline">{CAUSE_LABEL[f.cause_class]}{!f.cause_confirmed && " · AI"}</span>}</div>
                        <div style={{ marginTop: 6 }}>{f.detail}</div>
                        {f.root_cause && role !== "employee" && <div className="small ink2" style={{ marginTop: 4 }}><b>Root cause:</b> {f.root_cause}</div>}
                        <div className="xs muted" style={{ marginTop: 4 }}>Owner {f.owner_label} · raised {fmtDate(f.raised_at)} · due <span style={f.due_at < TODAY ? { color: "var(--sev-high)", fontWeight: 650 } : undefined}>{fmtDate(f.due_at)}</span></div>
                      </div>
                      {show.actions && (act
                        ? <button className="btn sm" onClick={() => setDrawer(f.id)}>{{ draft: "Review draft", approved: "In outbox", sent: "Waiting reply", answered: "Answered", rejected: "" }[act.status]}</button>
                        : <button className="btn sm primary" onClick={() => setDrawer(f.id)}><Wand2 size={13} />Draft next action</button>)}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Conflicts panel */}
          {(conflict || c.outcome) && role !== "hr" && <ConflictsPanel caseId={c.id} />}

          {/* Score breakdown */}
          {show.breakdown && (
            <Card id="breakdown" title="Score breakdown" sub={`Profile: ${db.weight_profiles.find((w) => w.id === score.profile_id)?.name} v${db.weight_profiles.find((w) => w.id === score.profile_id)?.version}. Click a component to see its evidence.`}>
              <table className="table">
                <thead><tr><th>Component</th><th className="tight">Weight</th><th style={{ width: "34%" }}>Value</th><th className="tight">Points</th><th className="tight">Evidence</th></tr></thead>
                <tbody>
                  {score.components.filter((k) => show.oneOnOne || !k.key.startsWith("oneonone")).map((k) => {
                    const W = score.components.filter((x) => x.value != null).reduce((a, x) => a + x.weight, 0);
                    return (
                      <tr key={k.key} className={`clickable ${focus === k.key ? "sel" : ""}`} onClick={() => setFocus(focus === k.key ? null : k.key)}>
                        <td className="strong">{k.label}</td>
                        <td className="num">{k.weight}%</td>
                        <td>{k.value == null ? <span className="row gap6"><div className="bar empty" style={{ flex: 1 }}><span style={{ width: "100%" }} /></div><span className="xs muted nowrap">No data</span></span>
                          : <span className="row gap6"><div className="bar hl" style={{ flex: 1 }}><span style={{ width: `${k.value}%` }} /></div><span className="num small strong" style={{ width: 28, textAlign: "right" }}>{Math.round(k.value)}</span></span>}</td>
                        <td className="num small">{k.value == null ? "–" : ((k.weight * k.value) / W).toFixed(1)}</td>
                        <td className="num small">{k.evidence_ids.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="divider" />
              <div className="small ink2">
                Score = Σ(weight × value) ÷ weights with data ({score.components.filter((x) => x.value != null).reduce((a, x) => a + x.weight, 0)} of {score.components.reduce((a, x) => a + x.weight, 0)}) = <b>{score.raw ?? "–"}</b>
                {score.capped ? <> → capped at <b>{db.config.tl_cap}</b> (TL gate)</> : null}. Bands: 0–39 Not ready · 40–64 Partially Ready · 65–84 Ready with Support · 85–100 Ready.
                {!show.oneOnOne && " 1:1 ratings are part of the score but not shown in this view."}
              </div>
            </Card>
          )}

          {/* Evidence timeline */}
          {show.evidence && <EvidenceTimeline caseId={c.id} focus={focus} clearFocus={() => setFocus(null)} hideOneOnOne={!show.oneOnOne} />}
          {(role === "pmo" || role === "tl" || role === "lm") && <PasteUpdate caseId={c.id} />}
        </div>

        <div className="stack">
          {show.scopes && (
            <Card title="Readiness per scope" sub="Levels move only with evidence; the TL validates." action={role === "tl" && pendingVal.length ? <Link href="/validation" className="btn sm">Validate</Link> : undefined}>
              {db.scopes.filter((s) => s.case_id === c.id).length === 0 ? <Empty title="No scopes yet">Scopes are set when the project and KT plan are confirmed.</Empty> : (
                <div className="list">
                  {db.scopes.filter((s) => s.case_id === c.id).map((s) => {
                    const v = db.validations.find((x) => x.scope_id === s.id);
                    const last = db.evidence.filter((e) => e.scope_id === s.id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
                    return (
                      <div key={s.id} style={{ padding: "11px 0" }}>
                        <div className="row between"><span className="strong small">{s.name}</span><LevelTag level={s.level} /></div>
                        <div style={{ margin: "7px 0 5px" }}><LevelStepper level={s.level} proposed={v && !v.decided_level ? v.proposed_level : null} /></div>
                        <div className="row between xs muted">
                          <span>{s.is_core ? "Core scope" : "Non-core"}{s.added_by_requirement && " · client requirement"} · last evidence {last ? fmtDate(last.occurred_at) : "none"}</span>
                          {v && !v.decided_level && <span className="ai" style={{ height: 18 }}>AI proposes {LEVEL_LABEL[v.proposed_level]}</span>}
                          {v?.decided_level && v.decided_by && <span>Decided by {userName(db, v.decided_by)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {show.access && (
            <Card title="Access per system" sub="Only usable counts as complete. No passwords are stored.">
              {db.access_items.filter((a) => a.case_id === c.id).length === 0 ? <Empty title="No access record">No systems are recorded for this onboarding.</Empty> : (
                <div className="list">
                  {db.access_items.filter((a) => a.case_id === c.id).map((a) => (
                    <div key={a.id} style={{ padding: "11px 0" }}>
                      <div className="row between wrap"><span className="strong small">{a.system}</span><AccessPipe state={a.state} /></div>
                      <div className="xs muted" style={{ marginTop: 5 }}>Owner {a.owner_label} · requested {fmtDate(a.requested_at)}{a.state !== "usable" && <> · {daysAgo(a.requested_at)} days waiting · next follow-up {a.next_followup_at ? fmtDate(a.next_followup_at) : <b style={{ color: "var(--sev-high)" }}>none</b>}</>}</div>
                      {a.note && <div className="xs ink2" style={{ marginTop: 2 }}>{a.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {show.score && role !== "employee" && <ScoreHistory caseId={c.id} />}

          <Card title="Contacts and documents">
            <div className="list">
              {[["Tech Lead / KT owner", c.tl_id], ["Line Manager", c.line_manager_id]].map(([l, uid]) => (
                <div key={l} className="li" style={{ alignItems: "center" }}>
                  {uid ? <Avatar name={userName(db, uid)!} /> : <span className="avatar">?</span>}
                  <div style={{ flex: 1 }}><div className="small strong">{uid ? userName(db, uid) : <span className="missing">Not assigned</span>}</div><div className="xs muted">{l}</div></div>
                </div>
              ))}
              {db.doc_references.filter((d) => d.project_id === c.project_id).map((d) => (
                <div key={d.id} className="li" style={{ alignItems: "center" }}>
                  <span className="avatar"><FolderOpen size={15} /></span>
                  <div style={{ flex: 1 }}><DocLink title={d.title} url={d.url} className="small strong" /><div className="src">{d.folder_ref}</div><div className="xs muted">Reference only, kept in the project folder · {d.verified_at ? `verified ${fmtDate(d.verified_at)}` : "not verified"}</div></div>
                </div>
              ))}
            </div>
          </Card>

          {role !== "employee" && role !== "hr" && <DecisionsLog caseId={c.id} />}
        </div>
      </div>

      {show.actions && <NextActionDrawer flagId={drawer} onClose={() => setDrawer(null)} />}
      {show.rate && <OneOnOneModal caseId={c.id} open={rate} onClose={() => setRate(false)} onDone={setToast} />}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}

/** A1 for text typed in AXON (Gemini setup doc): paste an email or note; only the extracted facts are stored. */
function PasteUpdate({ caseId }: { caseId: string }) {
  const { pasteUpdate, aiLive } = useAxon();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Awaited<ReturnType<typeof pasteUpdate>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null); setRes(null);
    try { const r = await pasteUpdate(caseId, text); setRes(r); if (r.source === "ai") setText(""); }
    catch (e) { console.error(e); setErr("The extraction failed. Try again."); } finally { setBusy(false); }
  };
  return (
    <Card title="Paste an update" sub="Paste an email, chat message or note. The Evidence Extractor (A1) turns it into evidence; the text itself is not stored.">
      <textarea className="input" rows={4} style={{ width: "100%", resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
        placeholder="e.g. Hi Sara, Orion Portal was approved yesterday and Leo can log in. Helix is still not provisioned." aria-label="Update text" />
      <div className="row gap6" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn primary sm" onClick={run} disabled={busy || text.trim().length < 10}>{busy ? "AI is reading…" : "Extract evidence"}</button>
        {err && <span className="small" style={{ color: "var(--sev-high)" }}>{err}</span>}
        {res && res.source === "mock" && <span className="small ink2">{aiLive ? "AI unavailable right now." : "Demo mode: set NEXT_PUBLIC_DATA_SOURCE=api for live AI."}</span>}
      </div>
      {res && res.source === "ai" && (
        <div className="small" style={{ marginTop: 10 }}>
          <div className="row gap6"><AiChip label="AI" /><b>{res.summaries.length} fact{res.summaries.length === 1 ? "" : "s"} saved</b>
            {res.status !== "ok" && <span className="tag outline xs">Needs PMO review</span>}
            {res.case_id && res.case_id !== caseId && <span className="tag outline xs">Matched to {res.case_id}</span>}</div>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{res.summaries.map((x, i) => <li key={i} className="ink2">{x}</li>)}</ul>
          {(res.access > 0 || res.flags_explained > 0 || res.reassessed) && <div className="xs muted" style={{ marginTop: 4 }}>
            {[res.access ? `${res.access} access change proposed` : "", res.flags_explained ? `${res.flags_explained} new flag explained by A2` : "", res.reassessed ? "readiness reassessed by A3" : ""].filter(Boolean).join(" · ")}</div>}
        </div>
      )}
    </Card>
  );
}

function ConflictsPanel({ caseId }: { caseId: string }) {
  const { db, user } = useAxon();
  const c = db.cases.find((x) => x.id === caseId)!;
  const f = db.flags.find((x) => x.case_id === caseId && x.type === "conflict");
  if (!f) return null;
  const [a, b] = f.evidence_ids.map((id) => db.evidence.find((e) => e.id === id)!).filter(Boolean);
  if (!a || !b) return null;
  const tl = userName(db, c.tl_id);
  const decision = db.audit_log.find((x) => x.entity_id === caseId && x.action === "set_outcome");
  return (
    <Card title={<span className="row gap6"><Scale size={16} />Conflicting updates</span>} sub="Same onboarding, same week, different claims. Both are kept as evidence.">
      <div className="side-compare">
        {[a, b].map((e, i) => (
          <div key={e.id} className="claim" style={i === 0 ? undefined : { order: 3 }}>
            <div className="xs muted">{EVIDENCE_KIND_LABEL[e.kind]} · {fmtDate(e.occurred_at)}</div>
            <div className="strong" style={{ margin: "2px 0 6px" }}>{e.author_label}</div>
            <div className="tag violet" style={{ marginBottom: 6 }}>Claims: {e.claimed_status!.replace(/_/g, " ")}</div>
            <div className="small ink2">{e.summary}</div>
            <div className="src" style={{ marginTop: 6 }}>{e.source_ref}</div>
          </div>
        ))}
        <div className="vs" style={{ order: 2 }}>VS</div>
      </div>
      <div className="divider" />
      {f.status === "open" ? (
        <div className="row between wrap">
          <div className="small"><b>Who decides:</b> {tl ?? "the Tech Lead"} (Tech Lead). Readiness is a technical decision and needs observed execution.</div>
          {user?.role === "tl" && <Link href="/validation" className="btn sm primary">Decide in validation queue</Link>}
        </div>
      ) : (
        <div className="row gap6 small"><HumanChip who={tl ?? "TL"} when={f.resolved_at} label="Decided" /><span>{c.outcome ? `Outcome ${OUTCOME_LABEL[c.outcome]}.` : ""} {decision?.payload?.reason ? `“${String(decision.payload.reason)}”` : ""}</span></div>
      )}
    </Card>
  );
}

function EvidenceTimeline({ caseId, focus, clearFocus, hideOneOnOne }: { caseId: string; focus: ScoreComponent["key"] | null; clearFocus: () => void; hideOneOnOne: boolean }) {
  const { db } = useAxon();
  const score = computeScore(db, caseId);
  const weightOf = (k: EvidenceKind) => score.components.filter((x) => COMPONENT_KINDS[x.key].includes(k)).reduce((a, x) => a + x.weight, 0);
  const items = [
    ...db.evidence.filter((e) => e.case_id === caseId).map((e) => ({ ...e, _k: e.kind })),
    ...(hideOneOnOne ? [] : db.one_on_ones.filter((o) => o.case_id === caseId).map((o) => ({
      id: o.id, kind: "one_on_one" as EvidenceKind, _k: "one_on_one" as EvidenceKind, author_label: userName(db, o.rater_id) ?? "", occurred_at: o.held_at,
      summary: `1:1 rated ${o.rating_human}/10 by the rater; AI rated the note ${o.rating_ai ?? "–"}/10. “${o.note}”`, source_ref: `axon://one_on_one/${o.id}`, disputed: false, extracted_by: "manual", simulated: true, status: "ok" as const, value_0_100: null, support_level: null,
    }))),
    ...db.challenge_results.filter((r) => r.case_id === caseId).map((r) => ({
      id: r.id, kind: "challenge" as EvidenceKind, _k: "challenge" as EvidenceKind, author_label: userName(db, r.reviewed_by) ?? "TL", occurred_at: r.submitted_at,
      summary: `Challenge scored ${r.score}/100: ${db.challenges.find((x) => x.id === r.challenge_id)?.prompt.slice(0, 80)}…`, source_ref: `axon://challenge/${r.id}`, disputed: false, extracted_by: "manual", simulated: true, status: "ok" as const, value_0_100: r.score, support_level: null,
    })),
  ].filter((e) => !focus || COMPONENT_KINDS[focus].includes(e._k))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return (
    <Card title="Evidence timeline" sub="Every fact behind the status, with its source and date. AXON stores references, never message bodies."
      action={focus ? <button className="btn sm" onClick={clearFocus}>Show all</button> : undefined}>
      {items.length === 0 ? <Empty title="No evidence yet">Evidence arrives from connectors, check-ins and TL reviews.</Empty> : (
        <div className="timeline">
          {items.map((e) => {
            const Ic = KIND_ICON[e._k];
            return (
              <div key={e.id} className={`tl-item ${e.disputed ? "disputed" : ""}`}>
                <div className="tl-ic"><Ic size={13} /></div>
                <div>
                  <div className="row between wrap gap6">
                    <span className="small"><b>{EVIDENCE_KIND_LABEL[e._k]}</b> · {e.author_label} · {fmtDate(e.occurred_at)}</span>
                    <span className="row gap4">
                      {e.support_level && <span className="tag neutral xs">{LEVEL_LABEL[e.support_level]}</span>}
                      {e.disputed && <span className="tag high xs">Disputed</span>}
                      {e.extracted_by === "ai" && <AiChip label="Extracted by AI" />}
                      {e.simulated && <SimTag />}
                      {weightOf(e._k) ? <span className="tag outline xs" title="Weight of the score component this evidence feeds">Weight {weightOf(e._k)}%</span> : <span className="tag outline xs" title="Context for flags and conflicts; not a score component">Context</span>}
                    </span>
                  </div>
                  <div className="small" style={{ marginTop: 3 }}>{e.summary}</div>
                  <div className="src" style={{ marginTop: 3 }}><ExternalLink size={10} /> {e.source_ref}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ScoreHistory({ caseId }: { caseId: string }) {
  const { db } = useAxon();
  const now = computeScore(db, caseId);
  const snaps = db.score_snapshots.filter((s) => s.case_id === caseId).sort((a, b) => a.computed_at.localeCompare(b.computed_at));
  if (!snaps.length && now.score == null) return null;
  const pts = [...snaps.map((s) => ({ d: s.computed_at, v: s.score })), ...(now.score != null ? [{ d: TODAY, v: now.score }] : [])];
  return (
    <Card title="Score over time" sub={<span className="row gap6">Snapshots before today are <SimTag /></span>}>
      <LineChart height={190} categories={pts.map((p) => fmtDate(p.d))} series={[{ name: "Readiness score", data: pts.map((p) => p.v) }]}
        annotations={{ yaxis: [
          { y: 84, borderColor: "#301B69", strokeDashArray: 4, label: { text: "TL cap 84", style: { background: "#301B69", color: "#fff", fontSize: "10px" }, position: "right", textAnchor: "end", offsetX: -2 } },
          { y: 65, borderColor: "#B9AEDD", strokeDashArray: 3, label: { text: "Ready with Support 65", style: { background: "#fff", color: "#4A4363", fontSize: "10px" }, position: "right", textAnchor: "end", offsetX: -2 } },
        ] }} />
    </Card>
  );
}

function DecisionsLog({ caseId }: { caseId: string }) {
  const { db } = useAxon();
  const actIds = db.actions.filter((a) => a.case_id === caseId).map((a) => a.id);
  const valIds = db.validations.filter((v) => v.case_id === caseId).map((v) => v.id);
  const flagIds = db.flags.filter((f) => f.case_id === caseId).map((f) => f.id);
  const rows = db.audit_log.filter((a) => a.entity_id === caseId || actIds.includes(a.entity_id) || valIds.includes(a.entity_id) || a.entity_id.split(",").some((x) => flagIds.includes(x))).slice(0, 8);
  return (
    <Card title="Decisions log" sub="Every approval and validation, with who and when (audit_log).">
      {rows.length === 0 ? <Empty title="No decisions yet" icon={<FileText size={18} />}>Approvals, validations and replies appear here.</Empty> : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="li small">
              {r.actor.startsWith("agent:") || r.actor.startsWith("connector:") ? <AiChip label={r.actor.startsWith("agent:") ? r.actor.slice(6).split(" ")[0] : "Connector"} title={r.actor} /> : <span className="human" style={{ height: 20 }}><ShieldCheck size={11} />Person</span>}
              <div style={{ flex: 1 }}><b>{r.action.replace(/_/g, " ")}</b> · {r.actor}<div className="xs muted">{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} today</div></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

