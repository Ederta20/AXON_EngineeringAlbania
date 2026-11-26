"use client";
// L1 My people (TL / Line Manager; all onboardings for PMO, HR, Management):
// cards with stage, score, band, flags and days ahead of or behind the benchmark.
import { useState } from "react";
import Link from "next/link";
import { Star, TrendingDown, TrendingUp } from "lucide-react";
import { useAxon } from "@/lib/store";
import { atRisk, benchmarkStatus, casesFor, employee, openFlags, project } from "@/lib/selectors";
import { computeScore } from "@/lib/score";
import { Avatar, BandTag, Card, Empty, FlagTag, Needed, PageHead, Seg, StageTag, Toast } from "@/components/ui";
import { OneOnOneModal } from "@/components/OneOnOneModal";

type Filter = "all" | "flags" | "risk";

export default function MyPeople() {
  const { db, user } = useAxon();
  const [filter, setFilter] = useState<Filter>("all");
  const [rate, setRate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (!user) return null;
  const mine = casesFor(db, user);
  const showScore = user.role !== "hr";
  const canRate = user.role === "tl" || user.role === "lm";
  const list = mine.filter((c) => filter === "all" || (filter === "flags" ? openFlags(db, c.id).length > 0 : atRisk(db, c)));
  const flagged = mine.filter((c) => openFlags(db, c.id).some((f) => f.severity === "high"));
  const title = canRate ? "My people" : "All onboardings";

  return (
    <>
      <PageHead title={title} question={canRate ? "How are my people progressing, and what blocks them?" : "Every active onboarding, from evidence."}
        right={<Seg<Filter> value={filter} onChange={setFilter} options={[{ v: "all", label: `All ${mine.length}` }, { v: "flags", label: "With flags" }, { v: "risk", label: "At risk" }]} />} />
      {flagged.length ? (
        <Needed action={<Link className="btn" href={`/cases/${flagged[0].id}`}>Open {employee(db, flagged[0]).name.split(" ")[0]}</Link>}>
          {flagged.length} {flagged.length === 1 ? "person has" : "people have"} a high-severity flag. {employee(db, flagged[0]).name}: {openFlags(db, flagged[0].id)[0].detail}
        </Needed>
      ) : <Needed>No high-severity flags on your people.</Needed>}

      {list.length === 0 ? <Card><Empty title={mine.length ? "Nobody matches this filter" : "No onboardings assigned to you"} /></Card> : (
        <div className="grid g3">
          {list.map((c) => {
            const e = employee(db, c);
            const s = computeScore(db, c.id);
            const f = openFlags(db, c.id);
            const bm = benchmarkStatus(db, c);
            const risk = atRisk(db, c);
            return (
              <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column" }}>
                <Link href={`/cases/${c.id}`} className="card-pad" style={{ color: "inherit", textDecoration: "none", flex: 1 }}>
                  <div className="row between top">
                    <div className="row"><Avatar name={e.name} /><div><div className="strong">{e.name}</div><div className="xs muted"><span className="mono">{c.id}</span> · {project(db, c.project_id)?.name ?? "No project"}</div></div></div>
                    {showScore && <div style={{ textAlign: "right" }}><div className="num" style={{ fontSize: 26, fontWeight: 760, color: "var(--midnight)", lineHeight: 1 }}>{s.score ?? "–"}</div><div className="xs muted">{s.provisional && s.score != null ? "provisional" : s.capped ? "capped" : "score"}</div></div>}
                  </div>
                  <div className="row wrap gap6" style={{ marginTop: 12 }}><StageTag stage={c.stage} outcome={c.outcome} />{showScore && <BandTag band={s.band} />}</div>
                  {showScore && <div className="bar hl" style={{ marginTop: 12, opacity: s.provisional ? 0.55 : 1 }}><span style={{ width: `${s.score ?? 0}%` }} /></div>}
                  <div className="row between small" style={{ marginTop: 12 }}>
                    <span className="row gap4" style={{ color: bm.delta < 0 ? "var(--sev-high)" : "var(--ok)", fontWeight: 620 }}>{bm.delta < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{bm.label}</span>
                    {risk && <span className="tag high">At risk</span>}
                  </div>
                  <div className="divider" />
                  {f.length === 0 ? <div className="small" style={{ color: "var(--ok)", fontWeight: 600 }}>On track: no open flags</div> : (
                    <div className="stack" style={{ gap: 6 }}>
                      {f.slice(0, 2).map((x) => <div key={x.id}><FlagTag type={x.type} severity={x.severity} /></div>)}
                      {f.length > 2 && <span className="xs muted">+{f.length - 2} more</span>}
                    </div>
                  )}
                </Link>
                {canRate && (
                  <div style={{ padding: "0 20px 16px" }}><button className="btn sm" onClick={() => setRate(c.id)}><Star size={13} />Rate last 1:1</button></div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {rate && <OneOnOneModal caseId={rate} open onClose={() => setRate(null)} onDone={setToast} />}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
