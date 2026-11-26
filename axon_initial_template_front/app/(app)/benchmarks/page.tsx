"use client";
// X3 Paths and benchmarks: benchmark days per stage vs current cases; template changes (from A9) to approve.
import { useState } from "react";
import { useAxon } from "@/lib/store";
import { daysAgo } from "@/lib/dates";
import { TODAY } from "@/lib/seed";
import { STAGE_LABEL } from "@/lib/labels";
import type { Stage } from "@/lib/types";
import { AiChip, Card, Empty, HumanChip, Needed, PageHead, SimTag } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { employee, project } from "@/lib/selectors";

const ORDER: Stage[] = ["pre_onboarding", "setup", "in_kt", "awaiting_validation"];

export default function Benchmarks() {
  const { db, decideSuggestion } = useAxon();
  const [pathId, setPathId] = useState("pa-orion");
  const path = db.paths.find((p) => p.id === pathId)!;
  const bm = ORDER.map((s) => db.benchmarks.find((b) => b.path_id === pathId && b.stage === s)!);
  const cases = db.cases.filter((c) => c.path_id === pathId);
  const daysIn = (caseId: string, s: Stage) => {
    const h = db.stage_history.filter((x) => x.case_id === caseId).sort((a, b) => a.entered_at.localeCompare(b.entered_at));
    const i = h.findIndex((x) => x.stage === s);
    if (i < 0) return 0;
    const end = h[i + 1]?.entered_at ?? TODAY;
    return Math.max(0, daysAgo(h[i].entered_at, end));
  };
  const sugg = db.path_suggestions;
  const proposed = sugg.filter((s) => s.status === "proposed");

  return (
    <>
      <PageHead title="Paths and benchmarks" question="Where do onboardings on this path take longer than usual?" right={
        <select className="select" style={{ width: "min(260px, 100%)" }} value={pathId} onChange={(e) => setPathId(e.target.value)} aria-label="Path">
          {db.paths.map((p) => <option key={p.id} value={p.id}>{project(db, p.project_id)?.name} · {p.role_name}</option>)}
        </select>} />
      <Needed>{proposed.length ? `${proposed.length} template change${proposed.length > 1 ? "s" : ""} proposed from confirmed root causes. Approve the ones you want new onboardings to inherit.` : "No template changes waiting."}</Needed>
      <div className="grid split" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
        <Card title={`Days per stage · ${project(db, path.project_id)?.name}`} sub={<span className="row gap6">Benchmark = median of completed onboardings ({bm[0]?.n_completed ?? 0} on this path){bm[0]?.provisional && <span className="tag outline xs">Provisional</span>}<SimTag /></span>}>
          <BarChart height={280} categories={ORDER.map((s) => STAGE_LABEL[s])} colors={["#FF5B00", "#301B69", "#8261D1", "#354ED8"]}
            series={[{ name: "Benchmark (median)", data: bm.map((b) => b?.median_days ?? 0) }, ...cases.map((c) => ({ name: employee(db, c).name, data: ORDER.map((s) => daysIn(c.id, s)) }))]} />
        </Card>
        <Card title="Proposed template changes" sub="From the Process Improver (A9). The PMO approves.">
          {sugg.length === 0 ? <Empty title="No suggestions yet" /> : (
            <div className="list">
              {sugg.map((s) => (
                <div key={s.id} className="li">
                  <div style={{ flex: 1 }}>
                    <div className="small strong">{s.suggestion}</div>
                    <div className="xs muted">{project(db, db.paths.find((p) => p.id === s.path_id)?.project_id ?? null)?.name} · based on {s.cause_flag_ids.length} confirmed cause{s.cause_flag_ids.length > 1 ? "s" : ""}</div>
                    <div className="row gap6" style={{ marginTop: 6 }}>
                      {s.status === "proposed" ? <><AiChip /><button className="btn sm primary" onClick={() => decideSuggestion(s.id, true)}>Approve</button><button className="btn sm" onClick={() => decideSuggestion(s.id, false)}>Reject</button></>
                        : <HumanChip who={db.users.find((u) => u.id === s.approved_by)?.name ?? "PMO"} label={s.status === "approved" ? "Approved" : "Rejected"} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
