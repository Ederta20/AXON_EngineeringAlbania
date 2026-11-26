"use client";
// X2 Skill challenges: AI-drafted short scenario tasks per skill. The TL approves them before an employee sees them; the TL scores results.
import { useAxon } from "@/lib/store";
import { fmtDate } from "@/lib/dates";
import { AiChip, Card, Empty, HumanChip, Needed, PageHead, SimTag } from "@/components/ui";

export default function Challenges() {
  const { db, user, approveChallenge } = useAxon();
  const isTl = user?.role === "tl";
  const myCase = db.cases.find((c) => c.id === user?.case_id);
  const pathIds = isTl ? db.paths.filter((p) => p.project_id === user?.project_id).map((p) => p.id) : [myCase?.path_id];
  const list = db.challenges.filter((c) => pathIds.includes(db.skills.find((s) => s.id === c.skill_id)?.path_id ?? "")).filter((c) => isTl || c.approved_by);
  const pending = list.filter((c) => !c.approved_by);

  return (
    <>
      <PageHead title="Skill challenges" question={isTl ? "Which drafted challenges can my people use?" : "Short scenarios to show what I can do"} right={<SimTag />} />
      <Needed>{isTl ? (pending.length ? `${pending.length} AI-drafted challenge${pending.length > 1 ? "s wait" : " waits"} for your approval.` : "All challenges for your path are approved.") : list.length ? "Pick a challenge and write your answer. Your TL scores it; it counts up to 15% of your score." : "No challenges for your path yet."}</Needed>
      {list.length === 0 ? <Card><Empty title="No challenges for this path yet" /></Card> : (
        <div className="grid g2">
          {list.map((c) => {
            const skill = db.skills.find((s) => s.id === c.skill_id);
            const results = db.challenge_results.filter((r) => r.challenge_id === c.id && (isTl || r.case_id === myCase?.id));
            return (
              <Card key={c.id} title={skill?.name} action={c.approved_by ? <HumanChip who={db.users.find((u) => u.id === c.approved_by)?.name ?? "TL"} label="Approved" /> : <AiChip label="Drafted by AI" />}>
                <p style={{ marginTop: 0 }}>{c.prompt}</p>
                {results.length > 0 && <div className="small ink2">{results.map((r) => <div key={r.id}>{db.users.find((u) => u.case_id === r.case_id)?.name}: <b>{r.score ?? "not scored"}/100</b> · {fmtDate(r.submitted_at)}</div>)}</div>}
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                  {isTl && !c.approved_by && <button className="btn sm primary" onClick={() => approveChallenge(c.id)}>Approve for use</button>}
                  {!isTl && <button className="btn sm" disabled title="Submissions are simulated in this prototype">Answer (simulated)</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
