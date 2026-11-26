"use client";
// X7 Requirements Assistant (Core Manager): plain text in, requirement cards out (type, detail, path, effective date,
// affected cases, impact preview). Confirm, then it goes to Admin approval. It never changes weights or messages clients.
import { useState } from "react";
import { Loader2, Wand2, Trash2, Send, Info } from "lucide-react";
import { useAxon } from "@/lib/store";
import { project } from "@/lib/selectors";
import { fmtDate } from "@/lib/dates";
import { AiChip, Card, Empty, HumanChip, Needed, PageHead, Toast } from "@/components/ui";

const EXAMPLE = "Client Meridian now needs everyone on the Orion project to finish ITIL Foundation training and have Helix Service Desk access by 15 Nov.";
type Cards = Awaited<ReturnType<ReturnType<typeof useAxon>["parseRequirements"]>>["cards"];

export default function Requirements() {
  const { db, parseRequirements, submitRequirements } = useAxon();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<Cards>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mine = db.client_requirements;

  const parse = async () => { setBusy(true); const r = await parseRequirements(text); setBusy(false); setCards(r.cards); setQuestion(r.question); };

  return (
    <>
      <PageHead title="Requirements assistant" question="Which client requirements change onboarding?" />
      <Needed>{mine.filter((r) => r.status === "submitted").length ? `${mine.filter((r) => r.status === "submitted").length} requirement change(s) wait for Admin approval.` : "Paste or type a client requirement. You confirm each card before it goes to the Admin."}</Needed>

      <div className="grid g-case">
        <div className="stack">
          <Card title="Describe the requirement" sub="Plain words, or paste from the client email. Only the structured result is stored, never the email.">
            <textarea className="textarea" style={{ minHeight: 110 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} aria-label="Requirement text" />
            <div className="row between" style={{ marginTop: 10 }}>
              <button className="linkbtn small" onClick={() => setText(EXAMPLE)}>Use an example</button>
              <button className="btn primary" disabled={busy || text.trim().length < 10} onClick={parse}>{busy ? <><Loader2 size={15} className="spin" />Reading…</> : <><Wand2 size={15} />Parse into requirements</>}</button>
            </div>
          </Card>

          {question && <div className="claim row gap6"><Info size={16} color="var(--violet)" /><span><b>One question:</b> {question}</span></div>}

          {cards.length > 0 && (
            <Card title={<span className="row gap6">Requirement cards <AiChip /></span>} sub="Edit or remove cards, then submit. Nothing applies until the Admin approves.">
              <div className="stack" style={{ gap: 12 }}>
                {cards.map((c, i) => (
                  <div key={i} className="claim">
                    <div className="row between"><span className="tag violet">{c.type}</span><button className="btn sm ghost" onClick={() => setCards((cs) => cs.filter((_, k) => k !== i))} aria-label="Remove card"><Trash2 size={14} /></button></div>
                    <div className="grid" style={{ gridTemplateColumns: "1fr 160px", gap: 10, marginTop: 8 }}>
                      <div className="field"><label>Detail</label><input className="input" value={c.detail} onChange={(e) => setCards((cs) => cs.map((x, k) => (k === i ? { ...x, detail: e.target.value } : x)))} /></div>
                      <div className="field"><label>Effective date</label><input className="input" type="date" value={c.effective_date ?? ""} onChange={(e) => setCards((cs) => cs.map((x, k) => (k === i ? { ...x, effective_date: e.target.value || null } : x)))} /></div>
                    </div>
                    <dl className="kv" style={{ marginTop: 10 }}>
                      <dt>Project</dt><dd>{project(db, c.project_id)?.name} · {db.clients.find((x) => x.id === c.client_id)?.name ?? "No client"}</dd>
                      <dt>Affected</dt><dd>{c.affected_case_ids.length ? c.affected_case_ids.map((id) => db.users.find((u) => u.case_id === id)?.name).join(", ") : "No active onboardings"}</dd>
                      <dt>Impact</dt><dd className="ink2">{c.impact}</dd>
                    </dl>
                  </div>
                ))}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setCards([])}>Discard</button>
                  <button className="btn primary" onClick={() => { submitRequirements(cards); setCards([]); setText(""); setToast("Sent to the Admin for approval"); }}><Send size={15} />Confirm and submit {cards.length}</button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card title="Your requirements" sub="Status after Admin review">
            {mine.length === 0 ? <Empty title="No requirements submitted yet" /> : (
              <div className="list">
                {mine.map((r) => (
                  <div key={r.id} className="li">
                    <div style={{ flex: 1 }}>
                      <div className="row between"><span className="small strong">{r.detail}</span><span className={`tag ${r.status === "approved" ? "ok" : r.status === "rejected" ? "high" : "medium"}`}>{r.status === "submitted" ? "Waiting for Admin" : r.status}</span></div>
                      <div className="xs muted">{project(db, r.project_id)?.name} · {r.type} · effective {fmtDate(r.effective_date)} · {r.affected_case_ids.length} case(s)</div>
                      {r.status !== "submitted" && r.approved_by && <div style={{ marginTop: 4 }}><HumanChip who={db.users.find((u) => u.id === r.approved_by)?.name ?? "Admin"} label={r.status === "approved" ? "Approved" : "Rejected"} /> {r.reason && <span className="xs muted">“{r.reason}”</span>}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="What this assistant can't do">
            <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Answer general questions. It only turns text into requirement cards.</li>
              <li>Change weights or thresholds, delete anything, or message clients.</li>
              <li>Apply anything without Admin approval. The TL later validates each new scope.</li>
            </ul>
            <div className="xs muted" style={{ marginTop: 8 }}>The same assistant runs as a bot in Teams.</div>
          </Card>
        </div>
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
