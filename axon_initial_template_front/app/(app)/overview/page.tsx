"use client";
// L3 Management overview: at-risk count, average score by team/project, on-time readiness rate, blockers by cause class.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Gauge, CalendarCheck, Flag, FilePlus2, Sparkles } from "lucide-react";
import { useAxon } from "@/lib/store";
import { atRisk, employee, openFlags, project, benchmarkStatus } from "@/lib/selectors";
import { computeScore } from "@/lib/score";
import { CAUSE_LABEL } from "@/lib/labels";
import type { CauseClass } from "@/lib/types";
import { AiChip, Avatar, BandTag, Card, Empty, FlagTag, Needed, PageHead, SimTag, Stat, StageTag } from "@/components/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/charts";

// Closed onboardings before the demo window: not in the starter pack, so simulated and labeled.
const ON_TIME_HISTORY = { months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"], rate: [58, 61, 55, 64, 67, 70], target: [80, 80, 80, 80, 80, 80] };

/** A8 Report Writer: the monthly management report. Numbers are computed by AXON; the model only words them. */
function ReportCard() {
  const { writeReport } = useAxon();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ source: "ai" | "mock"; subject: string; text: string } | null>(null);
  const run = async () => { setBusy(true); try { setR(await writeReport("management")); } catch (e) { console.error(e); setR({ source: "mock", subject: "Report failed", text: "The request failed. Try again." }); } finally { setBusy(false); } };
  return (
    <Card title="Monthly report" sub="Written by the Report Writer (A8). Every number comes from AXON's data; the AI only words it. Sent by email (simulated)."
      action={<button className="btn sm" onClick={run} disabled={busy}><Sparkles size={13} />{busy ? "AI is writing…" : r ? "Rewrite" : "Write report"}</button>}>
      {r ? <div><div className="row gap6" style={{ marginBottom: 6 }}><b>{r.subject}</b>{r.source === "ai" && <AiChip label="AI" />}</div><p className="small ink2" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.text}</p></div>
        : <div className="small muted">Press Write report for this month's summary.</div>}
    </Card>
  );
}

export default function Overview() {
  const { db, user } = useAxon();
  const router = useRouter();
  const active = db.cases.filter((c) => c.stage !== "closed");
  const scores = active.map((c) => ({ c, s: computeScore(db, c.id) }));
  const scored = scores.filter((x) => x.s.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, x) => a + x.s.score!, 0) / scored.length) : 0;
  const risk = active.filter((c) => atRisk(db, c));
  const flags = openFlags(db);
  const byProject = db.projects.map((p) => {
    const xs = scored.filter((x) => x.c.project_id === p.id);
    return { name: p.name, v: xs.length ? Math.round(xs.reduce((a, x) => a + x.s.score!, 0) / xs.length) : null };
  }).filter((x) => x.v != null) as { name: string; v: number }[];
  const causes = (Object.keys(CAUSE_LABEL) as CauseClass[]).map((k) => ({ k, n: flags.filter((f) => f.cause_class === k).length }));
  const unclassified = flags.filter((f) => !f.cause_class).length;
  const lowest = byProject.reduce((m, x, i, arr) => (x.v < arr[m].v ? i : m), 0);

  return (
    <>
      <PageHead title="Overview" question="Where is readiness at risk, and why?"
        right={user?.role === "core_manager" ? <Link className="btn primary" href="/requirements"><FilePlus2 size={15} />Add a client requirement</Link> : undefined} />
      {risk.length ? (
        <Needed action={<Link className="btn" href="/root-cause">See root causes</Link>}>
          {risk.length} onboarding{risk.length > 1 ? "s are" : " is"} behind benchmark with a low or missing score. Most open flags are {(() => { const t = causes.slice().sort((a, b) => b.n - a.n)[0]; return CAUSE_LABEL[t.k].toLowerCase(); })()} issues, which a template change can fix.
        </Needed>
      ) : <Needed>No onboarding is at risk.</Needed>}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="At risk" v={risk.length} unit={`of ${active.length}`} icon={<AlertTriangle size={14} />} d="Behind benchmark and below 65" />
        <Stat k="Average readiness score" v={avg} icon={<Gauge size={14} />} d={`${scored.length} people with a score; ${scored.filter((x) => x.s.provisional).length} provisional`} />
        <Stat k="On-time readiness" v={`${ON_TIME_HISTORY.rate.at(-1)}%`} icon={<CalendarCheck size={14} />} d={<span className="row gap4">Last 30 days <SimTag /></span>} />
        <Stat k="Open flags" v={flags.length} icon={<Flag size={14} />} d={`${flags.filter((f) => f.severity === "high").length} high severity`} />
      </div>

      <div style={{ marginBottom: 16 }}><ReportCard /></div>

      <div className="grid split" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", marginBottom: 16 }}>
        <Card title="Average score by project" sub="Current scores; provisional scores included">
          {byProject.length ? <BarChart height={250} categories={byProject.map((x) => x.name)} series={[{ name: "Average score", data: byProject.map((x) => x.v) }]} yMax={100} highlightIndex={lowest} /> : <Empty title="No scores yet" />}
          <div className="xs muted">Highlighted: lowest average.</div>
        </Card>
        <Card title="Blockers by cause class" sub={`Open flags. ${unclassified ? `${unclassified} not classified yet. ` : ""}Unconfirmed causes are AI proposals.`}>
          <DonutChart height={260} labels={causes.map((x) => CAUSE_LABEL[x.k])} series={causes.map((x) => x.n)} colors={["#FF5B00", "#301B69", "#8261D1", "#354ED8"]} />
        </Card>
      </div>

      <div className="grid split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
        <Card title="On-time readiness rate" sub={<span className="row gap6">Outcome reached by the expected date, per month <SimTag /></span>}>
          <AreaChart height={240} categories={ON_TIME_HISTORY.months} series={[{ name: "On time", data: ON_TIME_HISTORY.rate }, { name: "Target", data: ON_TIME_HISTORY.target }]} yMax={100} />
        </Card>
        <Card title="At-risk onboardings" pad={false}>
          {risk.length === 0 ? <Empty title="Nobody is at risk" /> : (
            <table className="table stack-sm" style={{ marginTop: 8 }}>
              <thead><tr><th>Employee</th><th>Stage</th><th>Score</th><th>Benchmark</th><th>Top flag</th></tr></thead>
              <tbody>
                {risk.map((c) => {
                  const s = computeScore(db, c.id); const f = openFlags(db, c.id)[0];
                  return (
                    <tr key={c.id} className="clickable" onClick={() => router.push(`/cases/${c.id}`)}>
                      <td className="cell-head"><div className="row"><Avatar name={employee(db, c).name} /><div><div className="strong small nowrap">{employee(db, c).name}</div><div className="xs muted">{project(db, c.project_id)?.name ?? "No project"}</div></div></div></td>
                      <td data-label="Stage"><StageTag stage={c.stage} /></td>
                      <td data-label="Score"><span className="num strong">{s.score ?? "–"}</span> <BandTag band={s.band} /></td>
                      <td data-label="Benchmark" className="small" style={{ color: "var(--sev-high)", fontWeight: 600 }}>{benchmarkStatus(db, c).label}</td>
                      <td data-label="Top flag">{f ? <FlagTag type={f.type} severity={f.severity} /> : <span className="xs muted">None</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
