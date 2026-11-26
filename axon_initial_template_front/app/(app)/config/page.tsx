"use client";
// X6 Configuration (Admin): weight profiles, thresholds, bands, and the "Pending requirement changes" approval tab.
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAxon } from "@/lib/store";
import type { Config, WeightProfile } from "@/lib/types";
import { project } from "@/lib/selectors";
import { fmtDate } from "@/lib/dates";
import { BAND_LABEL, BAND_RANGE } from "@/lib/labels";
import { AiChip, BandTag, Card, Empty, HumanChip, Needed, PageHead, Toast } from "@/components/ui";

type Tab = "pending" | "weights" | "thresholds";
const W_KEYS: [keyof WeightProfile, string][] = [["w_work", "Work evidence"], ["w_tl", "TL review"], ["w_1on1_human", "1:1 human"], ["w_1on1_ai", "1:1 AI"], ["w_challenge", "Challenges (max 15)"], ["w_self", "Self"]];

export default function Configuration() {
  const { db } = useAxon();
  const pending = db.client_requirements.filter((r) => r.status === "submitted");
  const [tab, setTab] = useState<Tab>(pending.length ? "pending" : "weights");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <PageHead title="Configuration" question="Are weights, thresholds and requirement changes correct?" />
      <Needed action={pending.length ? <button className="btn" onClick={() => setTab("pending")}>Review changes</button> : undefined}>
        {pending.length ? `${pending.length} client requirement change${pending.length > 1 ? "s wait" : " waits"} for your approval.` : "No pending requirement changes. Weight changes are versioned, so past scores stay explainable."}
      </Needed>
      <div className="tabs" role="tablist">
        <button className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>Pending requirement changes {pending.length > 0 && <span className="tag medium">{pending.length}</span>}</button>
        <button className={tab === "weights" ? "on" : ""} onClick={() => setTab("weights")}>Weight profiles</button>
        <button className={tab === "thresholds" ? "on" : ""} onClick={() => setTab("thresholds")}>Thresholds and bands</button>
      </div>
      {tab === "pending" && <Pending onToast={setToast} />}
      {tab === "weights" && <Weights onToast={setToast} />}
      {tab === "thresholds" && <Thresholds onToast={setToast} />}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}

function Pending({ onToast }: { onToast: (m: string) => void }) {
  const { db, decideRequirement } = useAxon();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const all = db.client_requirements;
  if (!all.length) return <Card><Empty title="No requirement changes yet">The Core Manager submits them from the Requirements assistant.</Empty></Card>;
  return (
    <div className="stack">
      {all.map((r) => (
        <Card key={r.id} title={r.detail} sub={`${project(db, r.project_id)?.name} · ${db.clients.find((c) => c.id === r.client_id)?.name ?? "No client"} · submitted by ${db.users.find((u) => u.id === r.submitted_by)?.name ?? "Core Manager"} on ${fmtDate(r.created_at)}`}
          action={r.status === "submitted" ? <AiChip label="Parsed by AI, confirmed by manager" /> : <HumanChip who={db.users.find((u) => u.id === r.approved_by)?.name ?? "Admin"} label={r.status === "approved" ? "Approved" : "Rejected"} />}>
          <dl className="kv">
            <dt>Type</dt><dd>{r.type}</dd>
            <dt>Effective</dt><dd>{fmtDate(r.effective_date, true)}</dd>
            <dt>Affected</dt><dd>{r.affected_case_ids.map((id) => db.users.find((u) => u.case_id === id)?.name).join(", ") || "None"}</dd>
            <dt>Impact</dt><dd className="ink2">{r.impact}</dd>
            <dt>On approval</dt><dd className="ink2">Rules (no AI) add the scope or access item, move expected dates if earlier, raise a client requirement flag and notify the TLs. New scopes cap scores again until the TL validates them.</dd>
          </dl>
          {r.status === "submitted" ? (
            <div className="row" style={{ marginTop: 14 }}>
              <input className="input" placeholder="Reason (required, logged)" value={reasons[r.id] ?? ""} onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))} />
              <button className="btn danger" disabled={(reasons[r.id] ?? "").trim().length < 3} onClick={() => { decideRequirement(r.id, false, reasons[r.id].trim()); onToast("Requirement rejected"); }}><X size={15} />Reject</button>
              <button className="btn primary" disabled={(reasons[r.id] ?? "").trim().length < 3} onClick={() => { decideRequirement(r.id, true, reasons[r.id].trim()); onToast("Requirement approved and applied"); }}><Check size={15} />Approve</button>
            </div>
          ) : r.reason && <div className="small muted" style={{ marginTop: 10 }}>Reason: “{r.reason}”</div>}
        </Card>
      ))}
    </div>
  );
}

function Weights({ onToast }: { onToast: (m: string) => void }) {
  const { db, updateProfile } = useAxon();
  const [edit, setEdit] = useState<Record<string, Partial<WeightProfile>>>({});
  return (
    <Card title="Weight profiles" sub="Matched by role, movement type and seniority. Weights must sum to 100; challenges never above 15." pad={false}>
      <table className="table" style={{ marginTop: 8 }}>
        <thead><tr><th>Profile</th>{W_KEYS.map(([, l]) => <th key={l}>{l}</th>)}<th>Sum</th><th>Version</th><th className="tight" /></tr></thead>
        <tbody>
          {db.weight_profiles.map((p) => {
            const cur = { ...p, ...edit[p.id] };
            const sum = W_KEYS.reduce((a, [k]) => a + Number(cur[k]), 0);
            const bad = sum !== 100 || Number(cur.w_challenge) > 15;
            const dirty = !!edit[p.id];
            return (
              <tr key={p.id}>
                <td className="strong">{p.name}<div className="xs muted">{db.cases.filter((c) => c.profile_id === p.id).length} cases</div></td>
                {W_KEYS.map(([k, l]) => (
                  <td key={k}><input aria-label={`${p.name} ${l}`} className="input num" type="number" min={0} max={k === "w_challenge" ? 15 : 100} style={{ width: 64, height: 32 }} value={Number(cur[k])}
                    onChange={(e) => setEdit((x) => ({ ...x, [p.id]: { ...x[p.id], [k]: Number(e.target.value) } }))} /></td>
                ))}
                <td className="num strong" style={{ color: bad ? "var(--sev-high)" : "var(--ok)" }}>{sum}</td>
                <td className="num small">v{p.version}</td>
                <td><button className="btn sm primary" disabled={!dirty || bad} onClick={() => { updateProfile(p.id, edit[p.id]); setEdit((x) => { const y = { ...x }; delete y[p.id]; return y; }); onToast(`${p.name} saved as v${p.version + 1}`); }}>Save</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Thresholds({ onToast }: { onToast: (m: string) => void }) {
  const { db, updateConfig } = useAxon();
  const [c, setC] = useState<Config>(db.config);
  const fields: [keyof Config, string, string][] = [
    ["stale_days", "Stale after (days)", "No update for longer than this raises a Stale flag"],
    ["escalate_days", "Escalate after (days)", "Access not usable or request not answered after this"],
    ["tl_cap", "TL gate cap", "Highest score before the TL validates every core scope"],
    ["provisional_below", "Provisional below (%)", "Completeness under this marks the score provisional"],
    ["rating_gap", "1:1 rating gap (points)", "AI vs human difference that raises a Rating gap flag"],
  ];
  return (
    <div className="grid g2">
      <Card title="Thresholds" sub="Used by the rules engine and the score service">
        <div className="stack" style={{ gap: 12 }}>
          {fields.map(([k, l, h]) => (
            <div key={k} className="field"><label htmlFor={k}>{l}</label>
              <input id={k} className="input num" type="number" value={Number(c[k])} onChange={(e) => setC((x) => ({ ...x, [k]: Number(e.target.value) }))} style={{ maxWidth: 140 }} />
              <span className="hint">{h}</span></div>
          ))}
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn primary" onClick={() => { updateConfig({ stale_days: c.stale_days, escalate_days: c.escalate_days, tl_cap: c.tl_cap, provisional_below: c.provisional_below, rating_gap: c.rating_gap }); onToast("Thresholds saved. Rules ran again."); }}>Save thresholds</button></div>
        </div>
      </Card>
      <Card title="Readiness bands" sub="One number, 0 to 100">
        <div className="list">
          {(["not_ready", "partially_ready", "ready_with_support", "ready"] as const).map((b) => (
            <div key={b} className="li" style={{ alignItems: "center" }}><BandTag band={b} /><span className="num small muted" style={{ marginLeft: "auto" }}>{BAND_RANGE[b]}</span></div>
          ))}
        </div>
        <div className="small ink2" style={{ marginTop: 10 }}>{BAND_LABEL.ready} needs the TL gate: every core scope validated.</div>
      </Card>
    </div>
  );
}
