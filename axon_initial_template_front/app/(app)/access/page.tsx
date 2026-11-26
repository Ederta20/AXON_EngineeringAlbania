"use client";
// L4 My access: each system's state; "It doesn't work" raises an access flag. Only "usable" counts as complete.
import { useState } from "react";
import { KeyRound, CheckCircle2, AlertOctagon } from "lucide-react";
import { useAxon } from "@/lib/store";
import { daysAgo, fmtDate } from "@/lib/dates";
import { AccessPipe, Card, Empty, Modal, Needed, PageHead, Toast } from "@/components/ui";

export default function MyAccess() {
  const { db, user, confirmAccess, reportAccessProblem } = useAxon();
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const c = db.cases.find((x) => x.id === user?.case_id);
  if (!c) return <Card><Empty title="No onboarding found for this user" /></Card>;
  const items = db.access_items.filter((a) => a.case_id === c.id);
  const usable = items.filter((a) => a.state === "usable").length;
  const toCheck = items.filter((a) => a.state === "approved");
  const item = items.find((a) => a.id === problem);

  return (
    <>
      <PageHead title="My access" question="Can I use every system I need?" />
      {toCheck.length ? <Needed>{toCheck.length === 1 ? `${toCheck[0].system} is approved.` : `${toCheck.length} systems are approved.`} Try {toCheck.length === 1 ? "it" : "them"} and tell us if {toCheck.length === 1 ? "it works" : "they work"}.</Needed>
        : items.length && usable === items.length ? <Needed>All your systems work. Nothing to do.</Needed>
          : <Needed>Some systems are still being set up. You don&apos;t need to chase them: AXON follows up with their owners.</Needed>}

      <div className="grid g3" style={{ marginBottom: 16 }}>
        {(["requested", "approved", "usable"] as const).map((s) => (
          <div key={s} className="card stat"><div className="k">{s === "usable" ? "Working" : s === "approved" ? "Approved, not checked" : "Requested"}</div>
            <div className="v">{items.filter((a) => a.state === s).length}<small>of {items.length}</small></div></div>
        ))}
      </div>

      <Card title="Systems" sub="Requested, approved and usable are different states. Passwords are never stored here.">
        {items.length === 0 ? <Empty title="No systems recorded" icon={<KeyRound size={18} />}>Your PMO has been asked which systems you need.</Empty> : (
          <div className="list">
            {items.map((a) => (
              <div key={a.id} className="li" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span className="avatar"><KeyRound size={15} /></span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="strong">{a.system}</div>
                  <div className="xs muted">Owner {a.owner_label} · requested {fmtDate(a.requested_at)}{a.state !== "usable" ? ` · ${daysAgo(a.requested_at)} days ago` : ""}{a.next_followup_at ? ` · next follow-up ${fmtDate(a.next_followup_at)}` : ""}</div>
                  {a.note && <div className="xs ink2">{a.note}</div>}
                </div>
                <AccessPipe state={a.state} />
                <div className="row gap6" style={{ minWidth: 230, justifyContent: "flex-end" }}>
                  {a.state === "approved" && <button className="btn sm primary" onClick={() => { confirmAccess(a.id); setToast(`${a.system} marked as working`); }}><CheckCircle2 size={14} />It works</button>}
                  {a.state !== "requested" && <button className="btn sm" onClick={() => setProblem(a.id)}><AlertOctagon size={14} />It doesn&apos;t work</button>}
                  {a.state === "requested" && <span className="xs muted">{a.owner_label === "Unassigned" ? "No owner yet: the PMO is on it" : `Waiting on ${a.owner_label}`}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!item} onClose={() => { setProblem(null); setNote(""); }} title={`${item?.system ?? ""} doesn't work`} sub="This raises an access flag for the PMO and the system owner.">
        <div className="field"><label htmlFor="acc-note">What happens when you try? (optional)</label>
          <textarea id="acc-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Login works but I see no projects" />
          <span className="hint">Don&apos;t include passwords or screenshots of credentials.</span></div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" onClick={() => setProblem(null)}>Cancel</button>
          <button className="btn primary" onClick={() => { reportAccessProblem(item!.id, note.trim()); setProblem(null); setNote(""); setToast("Access problem reported"); }}>Report problem</button>
        </div>
      </Modal>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
