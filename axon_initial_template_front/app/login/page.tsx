"use client";
// C1 Role switcher: pick a role, continue as that demo user. Permissions follow the role.
// Left: the roles. Right: where this role sits in the core flow, a live count from the data, and the role's question.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, Check, FileSearch, FileText, Flag, Gauge, LayoutDashboard, ListFilter, Radar, RefreshCw, Send, Settings2, ShieldCheck,
  UserPlus, UserRound, Users,
} from "lucide-react";
import { useAxon } from "@/lib/store";
import { homeFor } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { ROLE_LABEL, ROLE_QUESTION } from "@/lib/labels";
import { atRisk, casesFor, openFlags } from "@/lib/selectors";
import type { Db, Role, User } from "@/lib/types";

/** Which demo user stands in for each role. The person's name and title are read from the data. */
const DEMO: { role: Role; id: string }[] = [
  { role: "pmo", id: "u-pmo" },
  { role: "tl", id: "u-tl-orion" },
  { role: "employee", id: "u-e-005" },
  { role: "lm", id: "u-lm-luca" },
  { role: "mgmt", id: "u-mgmt" },
  { role: "hr", id: "u-hr" },
  { role: "core_manager", id: "u-cm" },
  { role: "admin", id: "u-admin" },
];

const ROLE_ICON: Record<Role, LucideIcon> = {
  pmo: Flag, tl: ShieldCheck, employee: UserRound, lm: Users, mgmt: LayoutDashboard, hr: UserPlus, core_manager: FileText, admin: Settings2,
};

type Step = "detect" | "triage" | "trace" | "score" | "act" | "validate" | "update";
const FLOW: { key: Step; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "detect", label: "Detect", icon: Radar, hint: "Rules raise flags on gaps" },
  { key: "triage", label: "Triage", icon: ListFilter, hint: "Each flag gets an owner and a cause" },
  { key: "trace", label: "Trace", icon: FileSearch, hint: "Evidence behind every status" },
  { key: "score", label: "Score", icon: Gauge, hint: "One readiness score, always explained" },
  { key: "act", label: "Act", icon: Send, hint: "AI drafts the next step; a person approves" },
  { key: "validate", label: "Validate", icon: ShieldCheck, hint: "The Tech Lead makes the final call" },
  { key: "update", label: "Update", icon: RefreshCw, hint: "Scores, flags and next steps refresh" },
];
/** The steps each role takes part in. */
const ROLE_STEPS: Record<Role, Step[]> = {
  pmo: ["triage", "trace", "act"],
  tl: ["trace", "validate"],
  employee: ["update"],
  lm: ["trace", "score"],
  mgmt: ["score"],
  hr: ["detect"],
  core_manager: ["detect", "update"],
  admin: ["score", "validate"],
};

/** A live count for the selected role, computed from the data (never typed in). */
function insight(db: Db, u: User): { value: number; label: string; note: string } {
  const mine = casesFor(db, u);
  const ids = new Set(mine.map((c) => c.id));
  const flags = openFlags(db).filter((f) => ids.has(f.case_id));
  const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
  switch (u.role) {
    case "tl": {
      const n = db.validations.filter((v) => v.tl_id === u.id && !v.decided_level).length;
      return { value: n, label: `${plural(n, "scope")} to validate`, note: `${mine.length} ${plural(mine.length, "person", "people")} on your projects` };
    }
    case "employee": {
      const n = flags.length;
      return { value: n, label: `open ${plural(n, "flag")} on your onboarding`, note: "Your next steps are waiting" };
    }
    case "lm": {
      const n = mine.length;
      const risk = mine.filter((c) => c.stage !== "closed" && atRisk(db, c)).length;
      return { value: n, label: `${plural(n, "person", "people")} you manage`, note: `${risk} at risk` };
    }
    case "mgmt": {
      const n = mine.filter((c) => c.stage !== "closed" && atRisk(db, c)).length;
      return { value: n, label: `${plural(n, "onboarding")} at risk`, note: `${mine.length} onboardings in total` };
    }
    case "hr": {
      const n = flags.filter((f) => f.type === "missing_info" || f.type === "date_mismatch").length;
      return { value: n, label: `${plural(n, "start")} missing information`, note: "Only you can confirm these" };
    }
    case "core_manager":
    case "admin": {
      const n = db.client_requirements.filter((r) => r.status === "submitted").length;
      return { value: n, label: `requirement ${plural(n, "change")} waiting`, note: u.role === "admin" ? "Waiting for your approval" : "Waiting for Admin approval" };
    }
    default: {
      const n = flags.length;
      const high = flags.filter((f) => f.severity === "high").length;
      return { value: n, label: `open ${plural(n, "flag")}`, note: `${high} high severity` };
    }
  }
}

export default function Login() {
  const { db, login } = useAxon();
  const router = useRouter();
  const people = DEMO.map((d) => ({ ...d, user: db.users.find((x) => x.id === d.id) })).filter((d): d is typeof d & { user: User } => !!d.user);
  const [pick, setPick] = useState<string>(DEMO[0].id);
  const chosen = people.find((p) => p.id === pick) ?? people[0];
  const go = () => { if (!chosen) return; login(chosen.id); router.push(homeFor(chosen.user.role)); };

  const steps = chosen ? ROLE_STEPS[chosen.role] : [];
  const stat = chosen ? insight(db, chosen.user) : null;
  const StatIcon = chosen ? ROLE_ICON[chosen.role] : Flag;

  return (
    <div className="login-shell"><div className="frame"><div className="app login-wrap">
      <section className="login-pane">
        <div className="login-form">
          <div className="login-mark"><Logo size={30} /></div>
          <h1>Who are you?</h1>
          <p className="login-sub">Pick a role to see onboarding the way they do.</p>

          <form onSubmit={(e) => { e.preventDefault(); go(); }}>
            <div className="role-list" role="radiogroup" aria-label="Role">
              {people.map((p) => {
                const Ic = ROLE_ICON[p.role];
                const on = p.id === chosen?.id;
                return (
                  <label key={p.id} className={`role-opt ${on ? "on" : ""}`}>
                    <input type="radio" name="role" value={p.id} checked={on} onChange={() => setPick(p.id)} onDoubleClick={go} />
                    <span className="role-check" aria-hidden>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="role-ic" aria-hidden><Ic size={17} /></span>
                    <span className="role-txt">
                      <span className="role-name">{ROLE_LABEL[p.role]}</span>
                      <span className="role-who">{p.user.name} · {p.user.title}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <button type="submit" className="btn primary login-go" disabled={!chosen}>
              {chosen ? <>Continue as {chosen.user.name.split(" ")[0]}<ArrowRight size={16} /></> : "Loading roles…"}
            </button>
          </form>
          <p className="login-foot">You can switch role any time from the header.</p>
        </div>
      </section>

      <section className="login-hero" aria-live="polite">
        <Logo variant="hero" className="login-watermark" />
        <div className="login-hero-in">
          <ol className="flow-rail" aria-label="How AXON works">
            {FLOW.map((s) => {
              const Ic = s.icon;
              const mine = steps.includes(s.key);
              return (
                <li key={s.key} className={mine ? "mine" : ""} title={`${s.label}: ${s.hint}`}>
                  <span className="flow-dot"><Ic size={mine ? 18 : 15} /></span>
                  <span className="flow-lbl">{s.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="flow-yours">Your part: {FLOW.filter((s) => steps.includes(s.key)).map((s) => s.label).join(" · ")}</div>

          {stat && (
            <div className="glance">
              <span className="glance-ic"><StatIcon size={18} /></span>
              <div className="glance-txt">
                <div className="glance-v"><b>{stat.value}</b> {stat.label}</div>
                <div className="glance-n">{stat.note}</div>
              </div>
              <span className="glance-tag">Live</span>
            </div>
          )}

          {chosen && <blockquote className="login-quote">“{ROLE_QUESTION[chosen.role]}”</blockquote>}
          <p className="login-lede">Finds the gaps in onboarding, shows the evidence behind each status, scores readiness and drafts the next step for its owner. The Tech Lead always makes the final call.</p>
        </div>
      </section>
    </div></div></div>
  );
}
