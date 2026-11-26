"use client";
// C2 Flags board (PMO home): every open gap by type, owner, age and cause. Entry point of the core flow.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag as FlagIc, Hourglass, AlarmClock, MailQuestion, Wand2, Check, UserRoundCog } from "lucide-react";
import { useAxon } from "@/lib/store";
import { openFlags, employee, project } from "@/lib/selectors";
import { daysAgo, fmtDate } from "@/lib/dates";
import { TODAY } from "@/lib/seed";
import { CAUSE_HINT, CAUSE_LABEL, FLAG_LABEL } from "@/lib/labels";
import type { CauseClass, FlagType, Severity } from "@/lib/types";
import { AiChip, Card, Empty, FlagTag, Needed, PageHead, SevTag, Stat, Avatar } from "@/components/ui";
import { NextActionDrawer } from "@/components/NextActionDrawer";
import { BarChart } from "@/components/charts";
import { FLAG_ORDER } from "@/lib/rules";

export default function FlagsBoard() {
  const { db, assignOwner, confirmCause, user } = useAxon();
  const router = useRouter();
  const flags = openFlags(db);
  const [type, setType] = useState<FlagType | "all">("all");
  const [owner, setOwner] = useState("all");
  const [proj, setProj] = useState("all");
  const [sev, setSev] = useState<Severity | "all">("all");
  const [sel, setSel] = useState<string[]>([]);
  const [bulkOwner, setBulkOwner] = useState("");
  const [drawer, setDrawer] = useState<string | null>(null);
  const readOnly = user?.role !== "pmo";

  const owners = useMemo(() => Array.from(new Set(flags.map((f) => f.owner_label))).sort(), [flags]);
  const shown = flags.filter((f) => {
    const c = db.cases.find((x) => x.id === f.case_id)!;
    return (type === "all" || f.type === type) && (owner === "all" || f.owner_label === owner) && (proj === "all" || (c.project_id ?? "none") === proj) && (sev === "all" || f.severity === sev);
  });

  const ages = flags.map((f) => daysAgo(f.raised_at));
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "0";
  const overdue = flags.filter((f) => f.due_at < TODAY).length;
  const unanswered = flags.filter((f) => f.type === "unanswered").length;
  const byType = FLAG_ORDER.map((t) => ({ t, n: flags.filter((f) => f.type === t).length })).filter((x) => x.n);
  const noAction = flags.filter((f) => f.severity === "high" && !db.actions.some((a) => a.flag_id === f.id && a.status !== "rejected"));
  const top = noAction[0];
  const actionOf = (id: string) => db.actions.filter((a) => a.flag_id === id && a.status !== "rejected").sort((a, b) => b.id.localeCompare(a.id))[0];
  const allIds = shown.map((f) => f.id);
  const ownerOptions = Array.from(new Set([...owners, ...db.users.filter((u) => ["hr", "lm", "tl", "pmo"].includes(u.role)).map((u) => `${u.name} (${u.role === "lm" ? "LM" : u.role === "tl" ? "TL" : u.role.toUpperCase()})`), "Access Support"]));

  return (
    <>
      <PageHead title="Flags board" question="Which gaps need an owner and a follow-up today?" />
      {top ? (
        <Needed action={!readOnly && <button className="btn" onClick={() => setDrawer(top.id)}><Wand2 size={15} />Draft next action</button>}>
          {noAction.length} high-severity flag{noAction.length > 1 ? "s have" : " has"} no follow-up yet. Start with {employee(db, db.cases.find((c) => c.id === top.case_id)!).name}: {FLAG_LABEL[top.type].toLowerCase()}.
        </Needed>
      ) : (
        <Needed>Every high-severity flag has a follow-up. Check the ones waiting for a reply.</Needed>
      )}

      <div className="grid split" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", marginBottom: 16 }}>
       <div className="grid g2">
        <Stat k="Open flags" v={flags.length} icon={<FlagIc size={14} />} d={`${flags.filter((f) => f.severity === "high").length} high severity`} />
        <Stat k="Average flag age" v={avgAge} unit="days" icon={<Hourglass size={14} />} d="Since the rule raised it" />
        <Stat k="Past deadline" v={overdue} icon={<AlarmClock size={14} />} d="Owner deadline passed" />
        <Stat k="Unanswered requests" v={unanswered} icon={<MailQuestion size={14} />} d="Sent, no reply past due" />
       </div>
          <Card title="Open flags by type" sub="Counts from the rules engine. Click a type to filter.">
            {byType.length ? <BarChart horizontal height={196} categories={byType.map((x) => FLAG_LABEL[x.t])} series={[{ name: "Open flags", data: byType.map((x) => x.n) }]}
              highlightIndex={byType.reduce((m, x, i, arr) => (x.n > arr[m].n ? i : m), 0)} onSelect={(i) => setType(type === byType[i].t ? "all" : byType[i].t)} /> : <Empty title="No open flags" />}
          </Card>
      </div>

      <div>
        <Card title="Open flags" sub={`${shown.length} of ${flags.length} shown. Raised by rules; causes proposed by AI until you confirm them.`} pad={false}
          action={
            <div className="row gap6 wrap filters">
              <select className="select" style={{ width: 150, height: 32 }} value={type} onChange={(e) => setType(e.target.value as FlagType | "all")} aria-label="Filter by type">
                <option value="all">All types</option>{FLAG_ORDER.map((t) => <option key={t} value={t}>{FLAG_LABEL[t]}</option>)}
              </select>
              <select className="select" style={{ width: 170, height: 32 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
                <option value="all">All owners</option>{owners.map((o) => <option key={o}>{o}</option>)}
              </select>
              <select className="select" style={{ width: 130, height: 32 }} value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filter by project">
                <option value="all">All projects</option>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="none">No project</option>
              </select>
              <select className="select" style={{ width: 120, height: 32 }} value={sev} onChange={(e) => setSev(e.target.value as Severity | "all")} aria-label="Filter by severity">
                <option value="all">Any severity</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
          }>
          {sel.length > 0 && !readOnly && (
            <div className="row wrap bulkbar" style={{ padding: "12px 20px", background: "rgba(89,53,175,.06)", borderTop: "1px solid var(--line)", marginTop: 12 }}>
              <UserRoundCog size={16} color="var(--violet)" /><b className="small">{sel.length} selected</b>
              <select className="select" style={{ width: "min(240px, 100%)", height: 32 }} value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} aria-label="New owner">
                <option value="">Assign owner…</option>{ownerOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
              <button className="btn sm primary" disabled={!bulkOwner} onClick={() => { assignOwner(sel, bulkOwner); setSel([]); setBulkOwner(""); }}>Assign</button>
              <button className="btn sm ghost" onClick={() => setSel([])}>Clear</button>
            </div>
          )}
          <div style={{ overflowX: "auto", marginTop: sel.length ? 0 : 8 }}>
            {shown.length === 0 ? <Empty title="No open flags">{flags.length ? "Nothing matches these filters." : "Every onboarding is on track."}</Empty> : (
              <table className="table stack-sm">
                <thead><tr>
                  {!readOnly && <th className="tight"><input type="checkbox" className="check" aria-label="Select all" checked={sel.length === allIds.length && allIds.length > 0} onChange={(e) => setSel(e.target.checked ? allIds : [])} /></th>}
                  <th>Employee</th><th>Flag</th><th>Cause class</th><th>Owner</th><th className="tight">Age</th><th className="tight">Severity</th><th className="tight">Follow-up</th>
                </tr></thead>
                <tbody>
                  {shown.map((f) => {
                    const c = db.cases.find((x) => x.id === f.case_id)!;
                    const e = employee(db, c);
                    const act = actionOf(f.id);
                    const late = f.due_at < TODAY;
                    return (
                      <tr key={f.id} className={`clickable ${sel.includes(f.id) ? "sel" : ""}`} onClick={() => router.push(`/cases/${c.id}?flag=${f.id}`)}>
                        {!readOnly && <td className="cell-check" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="check" aria-label={`Select ${e.name}`} checked={sel.includes(f.id)} onChange={(ev) => setSel((s) => ev.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id))} /></td>}
                        <td className="cell-head" style={{ minWidth: 170 }}><div className="row"><Avatar name={e.name} /><div><div className="strong nowrap">{e.name}</div><div className="xs muted"><span className="mono">{c.id}</span> · {project(db, c.project_id)?.name ?? "No project"}</div></div></div></td>
                        <td className="cell-full" style={{ maxWidth: 340 }}><FlagTag type={f.type} severity={f.severity} /><div className="small ink2" style={{ marginTop: 4 }}>{f.detail}</div></td>
                        <td data-label="Cause class" onClick={(ev) => ev.stopPropagation()}>
                          {f.cause_class ? (
                            f.cause_confirmed || readOnly ? (
                              <div><span className="small strong" title={CAUSE_HINT[f.cause_class]}>{CAUSE_LABEL[f.cause_class]}</span>
                                <div className="xs muted row gap4">{f.cause_confirmed ? <><Check size={12} />Confirmed by PMO</> : "Proposed by AI"}</div></div>
                            ) : <CauseConfirm value={f.cause_class} onConfirm={(v) => confirmCause(f.id, v)} />
                          ) : <span className="xs muted">Not classified</span>}
                        </td>
                        <td data-label="Owner"><div className="small strong">{f.owner_label}</div>{f.suggested_owner && f.suggested_owner !== f.owner_label && <div className="xs muted">AI suggests {f.suggested_owner}</div>}</td>
                        <td data-label="Age" className="num nowrap">{daysAgo(f.raised_at)}d<div className={`xs ${late ? "" : "muted"}`} style={late ? { color: "var(--sev-high)", fontWeight: 650 } : undefined}>{late ? "Overdue " : "Due "}{fmtDate(f.due_at)}</div></td>
                        <td data-label="Severity"><SevTag s={f.severity} /></td>
                        <td data-label="Follow-up" onClick={(ev) => ev.stopPropagation()}>
                          {act ? <button className="btn sm" onClick={() => setDrawer(f.id)}>{{ draft: "Review draft", approved: "In outbox", sent: "Waiting reply", answered: "Answered", rejected: "" }[act.status]}</button>
                            : readOnly ? <span className="xs muted">None</span> : <button className="btn sm primary" onClick={() => setDrawer(f.id)}><Wand2 size={13} />Draft</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

      </div>

      <NextActionDrawer flagId={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}

function CauseConfirm({ value, onConfirm }: { value: CauseClass; onConfirm: (v: CauseClass) => void }) {
  const [v, setV] = useState<CauseClass>(value);
  return (
    <div style={{ minWidth: 150 }}>
      <select className="cause-select" value={v} onChange={(e) => setV(e.target.value as CauseClass)} aria-label="Cause class" title={CAUSE_HINT[v]}>
        {(Object.keys(CAUSE_LABEL) as CauseClass[]).map((k) => <option key={k} value={k}>{CAUSE_LABEL[k]}</option>)}
      </select>
      <div className="row gap6" style={{ marginTop: 4 }}><AiChip label="AI" title="Cause proposed by the Root-Cause Analyst (A2)" /><button className="linkbtn xs" onClick={() => onConfirm(v)}>Confirm</button></div>
    </div>
  );
}
