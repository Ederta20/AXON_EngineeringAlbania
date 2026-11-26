"use client";
// L2 1:1 rating pop-up: 1-10 rating plus a note; the AI score (A6) appears beside it; a gap over 2 points is flagged.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAxon } from "@/lib/store";
import { AiChip, Modal } from "./ui";

export function OneOnOneModal({ caseId, open, onClose, onDone }: { caseId: string; open: boolean; onClose: () => void; onDone?: (msg: string) => void }) {
  const { db, submitOneOnOne } = useAxon();
  const c = db.cases.find((x) => x.id === caseId);
  const name = db.users.find((u) => u.id === c?.employee_id)?.name ?? "";
  const [rating, setRating] = useState(7);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ai: number; gap: boolean } | null>(null);

  const close = () => { setResult(null); setNote(""); setRating(7); onClose(); };
  return (
    <Modal open={open} onClose={close} title={`Rate your 1:1 with ${name}`} sub="Shown in Teams after the meeting. Counts 10% of the score; the AI rating counts 5%.">
      {!result ? (
        <div className="stack">
          <div className="field">
            <label>How did it go? <span className="num strong" style={{ color: "var(--deep)", marginLeft: 6 }}>{rating}/10</span></label>
            <div className="row gap4" role="radiogroup" aria-label="Rating">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className="btn sm"
                  style={{ width: 36, padding: 0, ...(rating === n ? { background: "var(--deep)", color: "#fff", borderColor: "var(--deep)" } : {}) }}>{n}</button>
              ))}
            </div>
            <span className="hint">Rubric: understanding, communication, confidence, issues raised.</span>
          </div>
          <div className="field"><label htmlFor="oo-note">Note</label>
            <textarea id="oo-note" className="textarea" placeholder="What did they handle well, and where do they still need help?" value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="hint">The 1:1 Scorer reads only this note. It is not shown to the employee.</span></div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={close}>Cancel</button>
            <button className="btn primary" disabled={busy || note.trim().length < 5} onClick={async () => { setBusy(true); const r = await submitOneOnOne(caseId, rating, note.trim()); setBusy(false); setResult(r); }}>
              {busy ? <><Loader2 size={15} className="spin" />Scoring note…</> : "Submit rating"}</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="grid g2">
            <div className="card flat card-pad"><div className="small muted">Your rating</div><div style={{ fontSize: 30, fontWeight: 760 }} className="num">{rating}<span className="muted" style={{ fontSize: 14 }}>/10</span></div></div>
            <div className="card flat card-pad"><div className="row between"><span className="small muted">AI rating of the note</span><AiChip label="AI" /></div><div style={{ fontSize: 30, fontWeight: 760 }} className="num">{result.ai}<span className="muted" style={{ fontSize: 14 }}>/10</span></div></div>
          </div>
          {result.gap
            ? <div className="claim" style={{ background: "var(--sev-low-bg)" }}><b>Rating gap flagged.</b> The two ratings differ by more than {db.config.rating_gap} points. The PMO sees a low-severity flag; nothing changes in the score until it is reviewed.</div>
            : <div className="claim">Ratings agree within {db.config.rating_gap} points. Both are now in the score.</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn primary" onClick={() => { onDone?.("1:1 rating saved"); close(); }}>Done</button></div>
        </div>
      )}
    </Modal>
  );
}
