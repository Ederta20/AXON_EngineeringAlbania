"use client";
// X1 Skills and docs: skills per path from the Doc agent (simulated), with doc links to their original location and coverage gaps.
import { FolderOpen, FileQuestion } from "lucide-react";
import { useAxon } from "@/lib/store";
import { project } from "@/lib/selectors";
import { fmtDate } from "@/lib/dates";
import { AiChip, Card, Empty, Needed, PageHead, SimTag } from "@/components/ui";
import { DocLink } from "@/components/DocLink";

export default function Skills() {
  const { db, user } = useAxon();
  const myCase = db.cases.find((c) => c.id === user?.case_id);
  const paths = user?.role === "employee" ? db.paths.filter((p) => p.id === myCase?.path_id)
    : user?.role === "tl" ? db.paths.filter((p) => p.project_id === user.project_id) : db.paths;
  const skills = db.skills.filter((s) => paths.some((p) => p.id === s.path_id));
  const gaps = skills.filter((s) => s.coverage < 50);

  return (
    <>
      <PageHead title="Skills and docs" question="What should I know for this path, and where is it written?" right={<span className="row gap6"><AiChip label="From the Doc agent" /><SimTag /></span>} />
      <Needed>{gaps.length ? `${gaps.length} skill${gaps.length > 1 ? "s have" : " has"} weak documentation: ${gaps.map((g) => g.name).join(", ")}.${user?.role === "tl" ? " Confirm the skill list or point to a document." : ""}` : "Every skill on this path has documentation."}</Needed>
      {paths.length === 0 ? <Card><Empty title="No path assigned yet">Skills appear once your project and role are confirmed.</Empty></Card> : paths.map((p) => {
        const ss = db.skills.filter((s) => s.path_id === p.id);
        return (
          <Card key={p.id} title={`${project(db, p.project_id)?.name} · ${p.role_name}`} sub="The Doc agent reads project folders in the company tenant and sends metadata only. Documents stay where they are." className="" >
            {ss.length === 0 ? <Empty title="No skills mapped for this path yet" /> : (
              <table className="table">
                <thead><tr><th>Skill</th><th>Document</th><th style={{ width: "28%" }}>Coverage</th><th className="tight">Updated</th></tr></thead>
                <tbody>{ss.map((s) => {
                  const d = db.doc_references.find((x) => x.id === s.doc_ref);
                  return (
                    <tr key={s.id}>
                      <td className="strong small">{s.name}</td>
                      <td>{d ? <span className="row gap6"><FolderOpen size={14} color="var(--deep)" /><span><DocLink title={d.title} url={d.url} className="small" /><div className="src">{d.folder_ref}</div></span></span>
                        : <span className="row gap6 small" style={{ color: "var(--sev-high)", fontWeight: 600 }}><FileQuestion size={14} />No document</span>}</td>
                      <td><span className="row gap6"><div className={`bar ${s.coverage < 50 ? "" : "hl"}`} style={{ flex: 1 }}><span style={{ width: `${s.coverage}%`, background: s.coverage < 50 ? "var(--sev-high)" : undefined }} /></div><span className="num small strong">{s.coverage}%</span></span></td>
                      <td className="small muted nowrap">{fmtDate(s.last_updated)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </Card>
        );
      })}
    </>
  );
}
