"use client";
// X5 Starts and movements (HR): did each onboarding start correctly? Missing project, role, TL, date mismatch.
// Starts are imported from the existing tracker; HR is asked only about what is missing.
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useAxon } from "@/lib/store";
import { employee } from "@/lib/selectors";
import { fmtDate } from "@/lib/dates";
import { TODAY } from "@/lib/seed";
import { MOVEMENT_LABEL } from "@/lib/labels";
import { Avatar, Card, Needed, PageHead, StageTag } from "@/components/ui";

export default function Starts() {
  const { db } = useAxon();
  const router = useRouter();
  const rows = db.cases.slice().sort((a, b) => b.start_date.localeCompare(a.start_date)).map((c) => {
    const checks = [
      { k: "Project", ok: !!c.project_id }, { k: "Exact role", ok: !!c.role }, { k: "Line Manager", ok: !!c.line_manager_id },
      { k: "TL / KT owner", ok: !!c.tl_id }, { k: "Stage matches date", ok: !(c.start_date <= TODAY && c.stage === "pre_onboarding") },
    ];
    return { c, checks, bad: checks.filter((x) => !x.ok) };
  });
  const bad = rows.filter((r) => r.bad.length);

  return (
    <>
      <PageHead title="Starts and movements" question="Did each onboarding start correctly?" />
      <Needed>{bad.length ? `${bad.length} start${bad.length > 1 ? "s are" : " is"} missing information only you can confirm. Fill the gaps and AXON tells the TL and Line Manager.` : "Every start has its project, role, managers and dates."}</Needed>
      <Card title="Imported from the onboarding tracker" sub="No re-entry: these rows come from the existing tracker. Only the gaps need you." pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>Employee</th><th>Movement</th><th>Start</th><th>Stage</th>{rows[0].checks.map((x) => <th key={x.k} className="tight">{x.k}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ c, checks }) => (
                <tr key={c.id} className="clickable" onClick={() => router.push(`/cases/${c.id}`)}>
                  <td><div className="row"><Avatar name={employee(db, c).name} /><div className="strong small nowrap">{employee(db, c).name}</div></div></td>
                  <td className="small">{MOVEMENT_LABEL[c.movement_type]}</td>
                  <td className="small nowrap">{fmtDate(c.start_date)}</td>
                  <td><StageTag stage={c.stage} outcome={c.outcome} /></td>
                  {checks.map((x) => (
                    <td key={x.k}>{x.ok ? <span className="tag ok" aria-label={`${x.k} confirmed`}><Check size={12} />OK</span> : <span className="tag high" aria-label={`${x.k} missing`}><X size={12} />Missing</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
