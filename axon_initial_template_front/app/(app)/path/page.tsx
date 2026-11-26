"use client";
// C6 My path (Employee home): stage tracker, next 3 actions, readiness per scope as levels (not the number),
// contacts, expected readiness date, report a blocker.
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, KeyRound, BookOpen, MessageCircle, Hourglass, Users, FolderOpen, CalendarDays, Megaphone, ShieldCheck } from "lucide-react";
import { useAxon } from "@/lib/store";
import { nextSteps, openFlags, project, userName } from "@/lib/selectors";
import { fmtDate, daysBetween } from "@/lib/dates";
import { TODAY } from "@/lib/seed";
import { LEVELS, LEVEL_HINT, LEVEL_LABEL, OUTCOME_LABEL, STAGE_LABEL, FLAG_LABEL } from "@/lib/labels";
import type { Stage } from "@/lib/types";
import { Avatar, Card, Empty, LevelStepper, LevelTag, Needed, PageHead, Toast } from "@/components/ui";

const TRACK: Stage[] = ["pre_onboarding", "setup", "in_kt", "awaiting_validation", "outcome", "closed"];
const STEP_ICON = { access: KeyRound, kt: Users, checkin: MessageCircle, doc: BookOpen, wait: Hourglass };

export default function MyPath() {
  const { db, user, toggleStep, reportBlocker } = useAxon();
  const [blocker, setBlocker] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const c = db.cases.find((x) => x.id === user?.case_id);
  if (!user || !c) return <Card><Empty title="No onboarding found for this user" /></Card>;

  const steps = nextSteps(db, c);
  const todo = steps.filter((s) => !db.done_steps.includes(s.key));
  const top3 = [...todo, ...steps.filter((s) => db.done_steps.includes(s.key))].slice(0, 3);
  const scopes = db.scopes.filter((s) => s.case_id === c.id);
  const proj = project(db, c.project_id);
  const idx = TRACK.indexOf(c.stage);
  const myOpen = openFlags(db, c.id).filter((f) => ["blocked", "access_delay"].includes(f.type));
  const docs = db.doc_references.filter((d) => d.project_id === c.project_id);
  const first = todo[0];

  return (
    <>
      <PageHead title={`Hi ${user.name.split(" ")[0]}`} question={`${proj ? `${proj.name} · ${c.role}` : "Your project is being confirmed"} · started ${fmtDate(c.start_date)}`} />
      {first ? (
        <Needed action={first.kind === "access" ? <Link className="btn" href="/access">Open my access</Link> : first.kind === "checkin" ? <Link className="btn" href="/checkin">Start check-in</Link> : undefined}>
          Next: {first.title}
        </Needed>
      ) : <Needed>You are up to date. Your next steps will appear here, and in Teams.</Needed>}

      <Card title="Where you are" sub="Your stage comes from evidence, not from the tracker." className="" >
        <div className="track" role="list">
          {TRACK.map((s, i) => (
            <div key={s} role="listitem" className={`st ${i < idx ? "done" : i === idx ? "now" : ""}`} aria-current={i === idx ? "step" : undefined}>
              <span className="n">Step {i + 1}</span>{s === "outcome" && c.outcome ? OUTCOME_LABEL[c.outcome] : STAGE_LABEL[s]}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-case" style={{ marginTop: 16 }}>
        <div className="stack">
          <Card title="Your next 3 steps" sub="Pulled from your access, KT plan and check-ins. Nothing to type twice.">
            {top3.length === 0 ? <Empty title="Nothing to do right now" icon={<CheckCircle2 size={18} />} /> : (
              <div className="list">
                {top3.map((s) => {
                  const done = db.done_steps.includes(s.key);
                  const Ic = STEP_ICON[s.kind];
                  return (
                    <div key={s.key} className="li step-li" style={{ alignItems: "center", opacity: done ? 0.55 : 1 }}>
                      <button className="btn icon ghost" onClick={() => toggleStep(s.key)} aria-label={done ? "Mark as not done" : "Mark as done"} disabled={s.kind === "wait"}>
                        {done ? <CheckCircle2 size={20} color="var(--ok)" /> : <Circle size={20} color="var(--ink-3)" />}
                      </button>
                      <span className="avatar"><Ic size={15} /></span>
                      <div style={{ flex: 1 }}>
                        <div className="strong" style={{ textDecoration: done ? "line-through" : undefined }}>{s.title}</div>
                        <div className="small muted">{s.detail}{s.due ? ` · follow-up ${fmtDate(s.due)}` : ""}</div>
                      </div>
                      <span className="tag outline step-owner">{s.owner === "You" ? "You" : `Waiting on ${s.owner}`}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Your readiness per scope" sub="Levels, not a number. Your Tech Lead validates each one from observed work.">
            {scopes.length === 0 ? <Empty title="No scopes yet">They are set when your project and KT plan are confirmed.</Empty> : (
              <div className="list">
                {scopes.map((s) => {
                  const next = LEVELS[Math.min(LEVELS.indexOf(s.level) + 1, LEVELS.length - 1)];
                  return (
                    <div key={s.id} style={{ padding: "12px 0" }}>
                      <div className="row between"><span className="strong">{s.name}</span><LevelTag level={s.level} /></div>
                      <div style={{ margin: "8px 0 6px" }}><LevelStepper level={s.level} /></div>
                      <div className="xs muted">{s.level === "validated" ? "Done. Confirmed by your Tech Lead." : `Now: ${LEVEL_HINT[s.level].toLowerCase()}. Next: ${LEVEL_LABEL[next]}.`}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Expected readiness">
            <div className="row gap16">
              <span className="avatar lg"><CalendarDays size={20} /></span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 720, color: "var(--midnight)" }}>{c.expected_ready_date ? fmtDate(c.expected_ready_date, true) : "Not set yet"}</div>
                <div className="small muted">{c.expected_ready_date ? `${daysBetween(TODAY, c.expected_ready_date)} days from today` : "Your PMO has asked for a date."}</div>
              </div>
            </div>
            {c.outcome && <div className="claim small" style={{ marginTop: 12 }}><ShieldCheck size={14} color="var(--deep)" /> Your Tech Lead set your outcome: <b>{OUTCOME_LABEL[c.outcome]}</b>.</div>}
          </Card>

          <Card title="Your contacts">
            <div className="list">
              {[["Tech Lead and KT owner", c.tl_id, "Ask about KT topics and validation"], ["Line Manager", c.line_manager_id, "Ask about blockers and your 1:1s"], ["PMO Coordinator", "u-pmo", "Ask about access and dates"]].map(([l, id, hint]) => (
                <div key={l} className="li" style={{ alignItems: "center" }}>
                  {id ? <Avatar name={userName(db, id)!} /> : <span className="avatar">?</span>}
                  <div><div className="small strong">{id ? userName(db, id) : "Being assigned"}</div><div className="xs muted">{l} · {hint}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Documents" sub="Links point to the project folder. Nothing is copied.">
            {docs.length === 0 ? <Empty title="No documents referenced yet" icon={<FolderOpen size={18} />} /> : (
              <div className="list">{docs.map((d) => (
                <div key={d.id} className="li"><FolderOpen size={16} color="var(--deep)" /><div><div className="small strong">{d.title}</div><div className="src">{d.folder_ref}</div></div></div>
              ))}</div>
            )}
          </Card>

          <Card title="Report a blocker" sub="Goes to your Line Manager as a flag. You can also reply to the AXON bot in Teams.">
            {myOpen.length > 0 && <div className="small" style={{ marginBottom: 10 }}>{myOpen.map((f) => <div key={f.id} className="row gap6"><Megaphone size={13} color="var(--sev-high)" />{FLAG_LABEL[f.type]}: {f.detail}</div>)}</div>}
            <textarea className="textarea" style={{ minHeight: 72 }} placeholder="What stops you, and since when?" value={blocker} onChange={(e) => setBlocker(e.target.value)} aria-label="Blocker description" />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn primary" disabled={blocker.trim().length < 5} onClick={() => { reportBlocker(c.id, blocker.trim()); setBlocker(""); setToast("Blocker sent to your Line Manager"); }}>Send blocker</button>
            </div>
          </Card>
        </div>
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
