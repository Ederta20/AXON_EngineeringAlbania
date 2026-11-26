"use client";
// X4 Root-cause report: flags grouped by cause class; process fixes vs company fixes; documentation compliance per team.
import { useAxon } from "@/lib/store";
import { CAUSE_HINT, CAUSE_LABEL, FLAG_LABEL } from "@/lib/labels";
import type { CauseClass } from "@/lib/types";
import { employee, project } from "@/lib/selectors";
import { AiChip, Card, Needed, PageHead, SimTag } from "@/components/ui";
import { BarChart } from "@/components/charts";

const CAUSES = Object.keys(CAUSE_LABEL) as CauseClass[];

export default function RootCause() {
  const { db } = useAxon();
  const flags = db.flags; // open and resolved: history matters for fixes
  const by = CAUSES.map((k) => ({ k, open: flags.filter((f) => f.cause_class === k && f.status === "open").length, resolved: flags.filter((f) => f.cause_class === k && f.status === "resolved").length }));
  const processFix = flags.filter((f) => f.cause_class === "process" || f.cause_class === "compliance");
  const companyFix = flags.filter((f) => f.cause_class === "external" || f.cause_class === "individual");
  const teams = db.projects.map((p) => {
    const sk = db.skills.filter((s) => db.paths.find((x) => x.id === s.path_id)?.project_id === p.id);
    return { name: p.name, v: sk.length ? Math.round(sk.reduce((a, s) => a + s.coverage, 0) / sk.length) : 0, n: sk.length };
  }).filter((t) => t.n);
  const unconfirmed = flags.filter((f) => f.cause_class && !f.cause_confirmed).length;

  return (
    <>
      <PageHead title="Root causes" question="Which fixes would prevent the most gaps?" />
      <Needed>{processFix.length} of {flags.length} flags trace back to the onboarding process or a team skipping a step. Those are fixable in the template; the rest need another team.{unconfirmed ? ` ${unconfirmed} causes are still AI proposals.` : ""}</Needed>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Flags by cause class" sub="Open and resolved">
          <BarChart height={250} stacked categories={CAUSES.map((k) => CAUSE_LABEL[k])} colors={["#FF5B00", "#B9AEDD"]} series={[{ name: "Open", data: by.map((x) => x.open) }, { name: "Resolved", data: by.map((x) => x.resolved) }]} />
        </Card>
        <Card title="Documentation coverage per team" sub={<span className="row gap6">From the Doc agent <SimTag /></span>}>
          <BarChart height={250} horizontal yMax={100} categories={teams.map((t) => t.name)} series={[{ name: "Coverage %", data: teams.map((t) => t.v) }]} highlightIndex={teams.reduce((m, t, i, a) => (t.v < a[m].v ? i : m), 0)} />
          <div className="xs muted">Highlighted: lowest coverage.</div>
        </Card>
      </div>
      <div className="grid g2">
        {[["Process fixes (template, workflow)", processFix], ["Company fixes (other teams, individuals)", companyFix]].map(([title, list]) => (
          <Card key={title as string} title={title as string} pad={false}>
            <table className="table" style={{ marginTop: 6 }}>
              <tbody>{(list as typeof flags).map((f) => {
                const c = db.cases.find((x) => x.id === f.case_id)!;
                return (
                  <tr key={f.id}>
                    <td style={{ width: "34%" }}><div className="small strong">{FLAG_LABEL[f.type]} · {employee(db, c).name}</div><div className="xs muted">{project(db, c.project_id)?.name ?? "No project"} · {f.status}</div></td>
                    <td><div className="small ink2">{f.root_cause ?? f.detail}</div><div className="row gap6" style={{ marginTop: 4 }}><span className="tag outline xs" title={f.cause_class ? CAUSE_HINT[f.cause_class] : ""}>{f.cause_class ? CAUSE_LABEL[f.cause_class] : "Unclassified"}</span>{!f.cause_confirmed && f.cause_class && <AiChip label="AI" />}</div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </Card>
        ))}
      </div>
    </>
  );
}
