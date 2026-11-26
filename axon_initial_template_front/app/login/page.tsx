"use client";
// C1 Role switcher and login: demo users per role; permissions follow the role.
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAxon } from "@/lib/store";
import { homeFor } from "@/components/Shell";
import { Avatar } from "@/components/ui";
import { ROLE_LABEL, ROLE_QUESTION } from "@/lib/labels";
import type { Role } from "@/lib/types";

const DEMO: { role: Role; id: string; note: string }[] = [
  { role: "pmo", id: "u-pmo", note: "Starts the demo: flags board" },
  { role: "tl", id: "u-tl-orion", note: "Validates Eva Stone (ONB-005)" },
  { role: "employee", id: "u-e-005", note: "Eva Stone, main demo case" },
  { role: "lm", id: "u-lm-luca", note: "Eva's Line Manager" },
  { role: "mgmt", id: "u-mgmt", note: "Risk and readiness overview" },
  { role: "hr", id: "u-hr", note: "Starts and movements" },
  { role: "core_manager", id: "u-cm", note: "Client requirements" },
  { role: "admin", id: "u-admin", note: "Weights, thresholds, approvals" },
];

export default function Login() {
  const { db, login } = useAxon();
  const router = useRouter();
  const go = (id: string) => { const u = db.users.find((x) => x.id === id)!; login(id); router.push(homeFor(u.role)); };

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="row gap16">
          <div className="brand-mark" style={{ width: 38, height: 38 }}><svg width="18" height="18" viewBox="0 0 16 16" aria-hidden><path d="M2 14 8 2l6 12M4.6 9h6.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><div className="brand-name" style={{ fontSize: 18 }}>AXON</div><div className="brand-sub" style={{ color: "#CFC4F2" }}>Engineering Albania · Student Hackathon prototype</div></div>
        </div>
        <div>
          <h1>When is a new hire ready? Decide it from evidence.</h1>
          <p>AXON finds the gaps in onboarding, shows the evidence behind each status, scores readiness and drafts the next step for its owner. The Tech Lead always makes the final call.</p>
          <div className="flow" aria-label="Core flow">
            {["Detect", "Triage", "Trace", "Score", "Act", "Validate", "Update"].map((s, i) => <span key={s}>{i + 1}. {s}</span>)}
          </div>
        </div>
        <div className="small" style={{ color: "#CFC4F2" }}>Fictional data from the Student Starter Pack. Teams and Outlook are simulated. App clock fixed at 14 Oct 2026.</div>
      </section>
      <section className="login-pane">
        <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "var(--midnight)", letterSpacing: "-0.02em" }}>Sign in as a demo user</h2>
        <p className="muted" style={{ marginTop: 0 }}>Each role sees only the screens and panels it needs. You can switch user any time from the header.</p>
        <div className="grid g2" style={{ marginTop: 20 }}>
          {DEMO.map((d) => {
            const u = db.users.find((x) => x.id === d.id)!;
            return (
              <button key={d.id} className="role-card" onClick={() => go(d.id)}>
                <Avatar name={u.name} lg dark={d.role === "pmo"} />
                <span style={{ flex: 1 }}>
                  <span className="xs strong" style={{ color: "var(--violet)" }}>{ROLE_LABEL[d.role]}</span>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: "var(--midnight)" }}>{u.name}</span>
                  <span className="small muted" style={{ display: "block" }}>{u.title}</span>
                  <span className="small ink2" style={{ display: "block", marginTop: 8 }}>“{ROLE_QUESTION[d.role]}”</span>
                  <span className="xs muted" style={{ display: "block", marginTop: 4 }}>{d.note}</span>
                </span>
                <ArrowRight size={16} color="var(--violet)" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
