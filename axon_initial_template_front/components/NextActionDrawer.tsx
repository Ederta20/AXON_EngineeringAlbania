"use client";
// C4 Next-action drawer: AI draft (recipient, channel, message, deadline) with the evidence it used.
// Approve / edit / reject. Shown as a Teams or Outlook preview. Approved actions go to the outbox;
// the mock connector delivers them (status sent). Replies come back through A5.
import { useEffect, useState } from "react";
import { Check, Loader2, Send, X, Reply, CircleDashed, FileText } from "lucide-react";
import { useAxon } from "@/lib/store";
import type { Action, Channel } from "@/lib/types";
import { AiChip, Drawer, FlagTag, HumanChip, SevTag, Avatar, Seg } from "./ui";
import { EVIDENCE_KIND_LABEL } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { employee, userName } from "@/lib/selectors";

export function NextActionDrawer({ flagId, onClose }: { flagId: string | null; onClose: () => void }) {
  const { db, draftNextAction, editAction, approveAction, rejectAction, simulateReply, user } = useAxon();
  const flag = db.flags.find((f) => f.id === flagId) ?? null;
  const actions = db.actions.filter((a) => a.flag_id === flagId).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const current = actions.find((a) => a.status !== "rejected") ?? null;
  const [drafting, setDrafting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<Partial<Action>>({});

  useEffect(() => { setLocal({}); setRejecting(false); setReason(""); }, [flagId, current?.id]);
  useEffect(() => {
    if (!flagId || !flag || current || drafting) return;
    setDrafting(true);
    draftNextAction(flagId).finally(() => setDrafting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagId, current?.id]);

  if (!flag) return null;
  const c = db.cases.find((x) => x.id === flag.case_id)!;
  const emp = employee(db, c);
  const a = current ? { ...current, ...local } : null;
  const dirty = Object.keys(local).length > 0;
  const evidence = db.evidence.filter((e) => a?.evidence_ids.includes(e.id) || flag.evidence_ids.includes(e.id));

  const foot = !a ? null : a.status === "draft" ? (
    rejecting ? (
      <>
        <input className="input" placeholder="Why is this draft wrong? (logged)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
        <button className="btn danger" disabled={reason.trim().length < 3} onClick={() => { rejectAction(a.id, reason.trim()); setRejecting(false); }}>Reject draft</button>
      </>
    ) : (
      <>
        <button className="btn danger" onClick={() => setRejecting(true)}><X size={15} />Reject</button>
        <div style={{ flex: 1 }} />
        {dirty && <button className="btn" onClick={() => { editAction(a.id, local); setLocal({}); }}>Save edits</button>}
        <button className="btn primary lg" onClick={() => { if (dirty) editAction(a.id, local); approveAction(a.id); }}><Send size={15} />Approve and send via {a.channel === "teams" ? "Teams" : "Outlook"}</button>
      </>
    )
  ) : a.status === "approved" ? (
    <span className="row small ink2"><Loader2 size={15} className="spin" />In the outbox. The mail and Teams connector is delivering it…</span>
  ) : a.status === "sent" ? (
    <>
      <span className="row small ink2"><Check size={15} color="var(--ok)" />Sent {fmtDate(a.sent_at)}. Waiting for {a.recipient}. Due {fmtDate(a.due_at)}.</span>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={() => simulateReply(a.id)} title="The mock connector posts a reply to /api/ingest/replies"><Reply size={15} />Simulate reply</button>
    </>
  ) : (
    <span className="row small ink2"><Check size={15} color="var(--ok)" />Answered {fmtDate(a.answered_at)}. The reply was added as evidence and the rules ran again.</span>
  );

  return (
    <Drawer open={!!flagId} onClose={onClose} title="Next action"
      sub={<span className="row gap6 wrap"><FlagTag type={flag.type} severity={flag.severity} /><SevTag s={flag.severity} /><span>{emp.name}</span></span>}
      foot={foot}>
      <div className="claim small ink2"><b style={{ color: "var(--ink)" }}>Gap:</b> {flag.detail}{flag.root_cause && <><br /><b style={{ color: "var(--ink)" }}>Likely cause:</b> {flag.root_cause}</>}</div>

      {(drafting || !a) && (
        <div className="card flat card-pad row" style={{ justifyContent: "center", minHeight: 120 }}>
          <Loader2 size={18} className="spin" /><span className="ink2">Next-Action Drafter is writing one message with one ask…</span>
        </div>
      )}

      {a && (
        <>
          <div className="row between">
            <div className="row gap6">
              {a.status === "draft" ? <AiChip label="Draft proposed by AI" /> : <HumanChip who={userName(db, a.approved_by) ?? "PMO"} label="Approved" />}
              <StatusPill a={a} />
            </div>
            {a.status === "draft" && (
              <Seg<Channel> value={a.channel} onChange={(v) => setLocal((l) => ({ ...l, channel: v }))} options={[{ v: "teams", label: "Teams" }, { v: "outlook", label: "Outlook" }]} />
            )}
          </div>

          <div className="grid g2">
            <div className="field"><label>Recipient</label>
              <input className="input" disabled={a.status !== "draft"} value={a.recipient} onChange={(e) => setLocal((l) => ({ ...l, recipient: e.target.value }))} />
              <span className="hint">{a.recipient_role}</span></div>
            <div className="field"><label>Deadline</label>
              <input className="input" type="date" disabled={a.status !== "draft"} value={a.due_at} onChange={(e) => setLocal((l) => ({ ...l, due_at: e.target.value }))} />
              <span className="hint">Escalates to the PMO after this date</span></div>
          </div>
          {a.channel === "outlook" && (
            <div className="field"><label>Subject</label>
              <input className="input" disabled={a.status !== "draft"} value={a.subject ?? ""} onChange={(e) => setLocal((l) => ({ ...l, subject: e.target.value }))} /></div>
          )}
          <div className="field"><label>Message (one ask)</label>
            <textarea className="textarea" disabled={a.status !== "draft"} value={a.body} onChange={(e) => setLocal((l) => ({ ...l, body: e.target.value }))} /></div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>Preview as the recipient sees it</div>
            <ChannelPreview a={a} from={user?.name ?? "PMO"} />
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Evidence the draft used</div>
            <div className="list">
              {evidence.length ? evidence.map((e) => (
                <div key={e.id} className="li"><FileText size={15} color="var(--deep)" style={{ marginTop: 2 }} />
                  <div><div className="small"><b>{EVIDENCE_KIND_LABEL[e.kind]}</b> · {e.author_label} · {fmtDate(e.occurred_at)}</div>
                    <div className="small ink2">{e.summary}</div><div className="src">{e.source_ref}</div></div></div>
              )) : <div className="small muted">Built from case fields: {flag.detail}</div>}
            </div>
          </div>

          {a.reply_summary && (
            <div className="claim" style={{ borderColor: "rgba(23,112,74,.3)", background: "var(--ok-bg)" }}>
              <div className="row gap6 small strong" style={{ color: "var(--ok)" }}><Reply size={14} />Reply from {a.recipient}, structured by the connector</div>
              <div className="small" style={{ marginTop: 4 }}>{a.reply_summary}</div>
              <div className="src" style={{ marginTop: 4 }}>{a.thread_ref}#reply</div>
            </div>
          )}
        </>
      )}

      {actions.filter((x) => x.status === "rejected").map((r) => (
        <div key={r.id} className="small muted row gap6"><CircleDashed size={13} />Earlier draft rejected: “{r.reject_reason}”</div>
      ))}
    </Drawer>
  );
}

function StatusPill({ a }: { a: Action }) {
  const map: Record<Action["status"], [string, string]> = {
    draft: ["Draft", "outline"], approved: ["In outbox", "blue"], sent: ["Sent, waiting", "medium"], answered: ["Answered", "ok"], rejected: ["Rejected", "high"],
  };
  const [l, cl] = map[a.status];
  return <span className={`tag ${cl}`}>{l}</span>;
}

export function ChannelPreview({ a, from }: { a: Pick<Action, "channel" | "recipient" | "subject" | "body" | "due_at">; from: string }) {
  if (a.channel === "teams") {
    return (
      <div className="preview">
        <div className="preview-bar"><span className="ch teams">T</span>Teams · chat with {a.recipient}<span className="tag sim xs" style={{ marginLeft: "auto" }}>Simulated</span></div>
        <div className="teams-msg">
          <Avatar name="AXON" dark />
          <div>
            <div className="small"><b>AXON</b> <span className="muted">on behalf of {from}</span></div>
            <div className="teams-card">
              <div style={{ whiteSpace: "pre-wrap" }}>{a.body}</div>
              <div className="row gap6" style={{ marginTop: 10 }}>
                <span className="btn sm primary" aria-hidden>Reply</span><span className="btn sm" aria-hidden>Open in AXON</span>
                <span className="xs muted" style={{ marginLeft: "auto" }}>Due {fmtDate(a.due_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="preview">
      <div className="preview-bar"><span className="ch outlook">O</span>Outlook · new message<span className="tag sim xs" style={{ marginLeft: "auto" }}>Simulated</span></div>
      <div className="mail-head">
        <span className="k">From</span><span>{from} via AXON</span>
        <span className="k">To</span><span>{a.recipient}</span>
        <span className="k">Subject</span><span className="strong">{a.subject}</span>
      </div>
      <div className="mail-body">{a.body}{"\n\n"}<span className="muted small">Reply to this email to update the onboarding record. Due {fmtDate(a.due_at)}.</span></div>
    </div>
  );
}
