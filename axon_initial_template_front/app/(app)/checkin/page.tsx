"use client";
// L5 Check-in and feedback: self-assessment per scope (1-10), rating of KT sessions and docs, free note.
// Counts 5% of the score. Also offered as a 3-tap Teams check-in.
import { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { useAxon } from "@/lib/store";
import { fmtDate } from "@/lib/dates";
import { Card, Empty, Needed, PageHead, Toast } from "@/components/ui";

function Stars({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  return (
    <div className="row gap4" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} className="btn icon ghost" style={{ width: 30, height: 30 }} onClick={() => onChange(n)} aria-label={`${n} of 5`}>
          <Star size={20} fill={value != null && n <= value ? "#FF5B00" : "none"} color={value != null && n <= value ? "#FF5B00" : "#B9AEDD"} />
        </button>
      ))}
      <span className="small muted" style={{ marginLeft: 4 }}>{value ? `${value}/5` : "Not rated"}</span>
    </div>
  );
}

export default function Checkin() {
  const { db, user, submitCheckin } = useAxon();
  const c = db.cases.find((x) => x.id === user?.case_id);
  const scopes = db.scopes.filter((s) => s.case_id === c?.id);
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(scopes.map((s) => [s.id, 5])));
  const [kt, setKt] = useState<number | null>(null);
  const [doc, setDoc] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  if (!c) return <Card><Empty title="No onboarding found for this user" /></Card>;
  const past = db.checkins.filter((x) => x.case_id === c.id).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHead title="Check-in and feedback" question="How do I feel about each part of my work, and is KT helping?" />
      <Needed>{past[0] ? `Your last check-in was on ${fmtDate(past[0].at)}.` : "You haven't checked in yet."} It takes about two minutes and counts 5% of your readiness.</Needed>
      <div className="grid g-case">
        <Card title="This week" sub="Rate how independently you can do each scope today. 1 = I only watch, 10 = I do it alone and know when to escalate.">
          {scopes.length === 0 ? <Empty title="No scopes yet">You can still rate KT and documents below.</Empty> : (
            <div className="list">
              {scopes.map((s) => (
                <div key={s.id} style={{ padding: "12px 0" }}>
                  <div className="row between"><label className="strong small" htmlFor={`r-${s.id}`}>{s.name}</label><span className="num strong" style={{ color: "var(--deep)" }}>{vals[s.id] ?? 5}/10</span></div>
                  <input id={`r-${s.id}`} type="range" min={1} max={10} className="range" value={vals[s.id] ?? 5} onChange={(e) => setVals((v) => ({ ...v, [s.id]: Number(e.target.value) }))} />
                </div>
              ))}
            </div>
          )}
          <div className="divider" />
          <div className="grid g2">
            <div className="field"><label>KT sessions this week</label><Stars value={kt} onChange={setKt} label="KT sessions rating" /></div>
            <div className="field"><label>Documentation</label><Stars value={doc} onChange={setDoc} label="Documentation rating" /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="ci-note">Anything else? (optional)</label>
            <textarea id="ci-note" className="textarea" style={{ minHeight: 72 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What helped, what is missing, what you need next" /></div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn primary" onClick={() => { submitCheckin(c.id, vals, kt, doc, note.trim()); setNote(""); setToast("Check-in sent. Your TL sees it next to your work evidence."); }}>Send check-in</button>
          </div>
        </Card>
        <div className="stack">
          <Card title="How your answers are used">
            <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Your self-assessment counts 5% of the readiness score.</li>
              <li>Your Tech Lead sees it beside your work evidence. It never moves a level on its own.</li>
              <li>KT and document ratings go to the PMO to improve the path for the next person.</li>
            </ul>
          </Card>
          <Card title="Past check-ins">
            {past.length === 0 ? <Empty title="No check-ins yet" /> : (
              <div className="list">{past.map((p) => (
                <div key={p.id} className="li small"><CheckCircle2 size={15} color="var(--ok)" /><div style={{ flex: 1 }}><b>{fmtDate(p.at)}</b> · self {p.self_score}/10{p.kt_rating ? ` · KT ${p.kt_rating}/5` : ""}{p.doc_rating ? ` · docs ${p.doc_rating}/5` : ""}{p.note && <div className="xs muted">{p.note}</div>}</div></div>
              ))}</div>
            )}
          </Card>
        </div>
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
