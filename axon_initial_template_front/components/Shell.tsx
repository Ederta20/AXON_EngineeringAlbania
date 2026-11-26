"use client";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import {
  Flag, Users, ShieldCheck, Route, LayoutDashboard, KeyRound, MessageSquareText, BookOpen, Puzzle, BarChart3, Search,
  UserPlus, Settings2, FileText, ChevronDown, RotateCcw, CalendarClock, LogOut, Menu, X, Bell, Gauge, AlertTriangle, Clock3, ArrowRight,
} from "lucide-react";
import { useAxon } from "@/lib/store";
import type { Db, Role, User } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";
import { Avatar } from "./ui";
import { Logo } from "./Logo";
import { atRisk, casesFor, employee, openFlags } from "@/lib/selectors";
import { tlGate } from "@/lib/score";
import { TODAY } from "@/lib/seed";
import { fmtDate } from "@/lib/dates";

type NavItem = { href: string; label: string; short?: string; icon: LucideIcon; tier?: "Extra"; count?: number };

export function homeFor(role: Role) {
  return ({ pmo: "/flags", tl: "/validation", lm: "/people", employee: "/path", hr: "/starts", mgmt: "/overview", core_manager: "/requirements", admin: "/config" } as const)[role];
}

const BrandMark = ({ size = 32 }: { size?: number }) => (
  <div className="brand-mark" style={{ width: size, height: size }}>
    <Logo size={Math.round(size * 0.62)} />
  </div>
);

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, db, ready, logout } = useAxon();
  const router = useRouter();
  const path = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  useEffect(() => { setNavOpen(false); scroller.current?.scrollTo({ top: 0 }); }, [path]);
  useEffect(() => {
    if (!navOpen) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navOpen]);
  if (!ready || !user) return null;

  const flagsOpen = openFlags(db).length;
  const pendingVal = db.validations.filter((v) => !v.decided_level && v.tl_id === user.id).length;
  const pendingReq = db.client_requirements.filter((r) => r.status === "submitted").length;

  const NAV: Record<Role, NavItem[]> = {
    pmo: [
      { href: "/flags", label: "Flags board", short: "Flags", icon: Flag, count: flagsOpen },
      { href: "/people", label: "All onboardings", short: "People", icon: Users },
      { href: "/benchmarks", label: "Paths and benchmarks", short: "Paths", icon: Route, tier: "Extra" },
      { href: "/root-cause", label: "Root causes", short: "Causes", icon: Search, tier: "Extra" },
    ],
    tl: [
      { href: "/validation", label: "Validation queue", short: "Queue", icon: ShieldCheck, count: pendingVal },
      { href: "/people", label: "My people", short: "People", icon: Users },
      { href: "/skills", label: "Skills and docs", short: "Skills", icon: BookOpen, tier: "Extra" },
      { href: "/challenges", label: "Skill challenges", short: "Challenges", icon: Puzzle, tier: "Extra" },
    ],
    lm: [{ href: "/people", label: "My people", short: "People", icon: Users }],
    employee: [
      { href: "/path", label: "My path", short: "My path", icon: Route },
      { href: "/access", label: "My access", short: "Access", icon: KeyRound },
      { href: "/checkin", label: "Check-in and feedback", short: "Check-in", icon: MessageSquareText },
      { href: "/skills", label: "Skills and docs", short: "Skills", icon: BookOpen, tier: "Extra" },
      { href: "/challenges", label: "Skill challenges", short: "Challenges", icon: Puzzle, tier: "Extra" },
    ],
    hr: [
      { href: "/starts", label: "Starts and movements", short: "Starts", icon: UserPlus, tier: "Extra" },
      { href: "/people", label: "All onboardings", short: "People", icon: Users },
    ],
    mgmt: [
      { href: "/overview", label: "Overview", short: "Overview", icon: LayoutDashboard },
      { href: "/root-cause", label: "Root causes", short: "Causes", icon: BarChart3, tier: "Extra" },
      { href: "/people", label: "All onboardings", short: "People", icon: Users },
    ],
    core_manager: [
      { href: "/requirements", label: "Requirements assistant", short: "Requirements", icon: FileText },
      { href: "/overview", label: "Overview", short: "Overview", icon: LayoutDashboard },
    ],
    admin: [
      { href: "/config", label: "Configuration", short: "Config", icon: Settings2, tier: "Extra", count: pendingReq },
      { href: "/flags", label: "Flags board", short: "Flags", icon: Flag },
    ],
  };

  const items = NAV[user.role];
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(href + "/"));
  const alerts = items.reduce((a, it) => a + (it.count ?? 0), 0);

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <div className="frame">
        <div className="app">
          <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden />
          <aside className="sidebar" id="axon-nav">
            <div className="brand">
              <BrandMark />
              <div style={{ flex: 1, minWidth: 0 }}><div className="brand-name">eng</div><div className="brand-sub">Onboarding and KT</div></div>
              <button className="btn icon ghost sm nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={17} /></button>
            </div>

            <nav className="nav-group" aria-label="Main">
              <div className="nav-label"><ChevronDown size={12} />Navigation · {ROLE_LABEL[user.role]}</div>
              {items.map((it) => {
                const Ic = it.icon;
                return (
                  <Link key={it.href} href={it.href} className={`nav-item ${isActive(it.href) ? "active" : ""}`} aria-current={isActive(it.href) ? "page" : undefined}>
                    <Ic size={16} /><span className="nav-txt">{it.label}</span>
                    {it.count ? <span className="count">{it.count}</span> : it.tier ? <span className="nav-tier">{it.tier}</span> : null}
                  </Link>
                );
              })}
            </nav>

            <SummaryCard db={db} user={user} />

            <div className="side-user">
              <Avatar name={user.name} dark />
              <div style={{ flex: 1, minWidth: 0 }}><div className="strong small ellipsis">{user.name}</div><div className="xs muted ellipsis">{user.title}</div></div>
              <button className="btn icon ghost sm" onClick={() => { logout(); router.push("/login"); }} aria-label="Back to sign-in" title="Back to sign-in"><LogOut size={15} /></button>
            </div>
          </aside>

          <div className="main" ref={scroller}>
            <TopBar onMenu={() => setNavOpen(true)} menuOpen={navOpen} alerts={alerts} />
            <main className="content" key={path}>{children}</main>
          </div>
        </div>
      </div>

      <nav className="tabbar" aria-label="Quick navigation">
        {items.slice(0, 5).map((it) => {
          const Ic = it.icon;
          const active = isActive(it.href);
          return (
            <Link key={it.href} href={it.href} className={`tab ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="tab-ic"><Ic size={19} />{it.count ? <span className="tab-count">{it.count}</span> : null}</span>
              <span className="tab-lbl">{it.short ?? it.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Three counts for the current role, computed by the rules engine and score service. */
function SummaryCard({ db, user }: { db: Db; user: User }) {
  const mine = casesFor(db, user);
  const ids = mine.map((c) => c.id);
  const flags = openFlags(db).filter((f) => ids.includes(f.case_id));
  let lines: { icon: LucideIcon; tone: string; text: string }[];
  let cta: { href: string; label: string };
  switch (user.role) {
    case "tl": {
      const pend = db.validations.filter((v) => v.tl_id === user.id && !v.decided_level).length;
      const capped = ids.filter((id) => !tlGate(db, id).passed).length;
      const conflicts = flags.filter((f) => f.type === "conflict").length;
      lines = [{ icon: ShieldCheck, tone: "violet", text: `${pend} scope${pend === 1 ? "" : "s"} to validate` }, { icon: Gauge, tone: "blue", text: `${capped} score${capped === 1 ? "" : "s"} capped at ${db.config.tl_cap}` }, { icon: AlertTriangle, tone: "high", text: `${conflicts} open conflict${conflicts === 1 ? "" : "s"}` }];
      cta = { href: "/validation", label: "Open validation queue" };
      break;
    }
    case "employee": {
      const acc = db.access_items.filter((a) => ids.includes(a.case_id) && a.state !== "usable").length;
      const c = mine[0];
      lines = [{ icon: Flag, tone: "high", text: `${flags.length} open flag${flags.length === 1 ? "" : "s"} on your onboarding` }, { icon: KeyRound, tone: "medium", text: `${acc} system${acc === 1 ? "" : "s"} not usable yet` }, { icon: CalendarClock, tone: "blue", text: c?.expected_ready_date ? `Expected ready ${fmtDate(c.expected_ready_date)}` : "Expected date not set" }];
      cta = { href: "/path", label: "See my next steps" };
      break;
    }
    default: {
      const high = flags.filter((f) => f.severity === "high").length;
      const late = flags.filter((f) => f.due_at < TODAY).length;
      const risk = mine.filter((c) => c.stage !== "closed" && atRisk(db, c)).length;
      lines = [{ icon: Flag, tone: "high", text: `${high} high-severity flag${high === 1 ? "" : "s"}` }, { icon: Clock3, tone: "medium", text: `${late} past the owner deadline` }, { icon: AlertTriangle, tone: "violet", text: `${risk} onboarding${risk === 1 ? "" : "s"} at risk` }];
      cta = { href: homeFor(user.role), label: user.role === "pmo" ? "Work the flags board" : "Open my home view" };
    }
  }
  return (
    <div className="side-card">
      <div className="side-card-h"><Gauge size={14} />Today at a glance</div>
      <ul>{lines.map((l, i) => { const Ic = l.icon; return <li key={i}><Ic size={13} className={`tone-${l.tone}`} />{l.text}</li>; })}</ul>
      <Link href={cta.href} className="btn sm primary" style={{ width: "100%" }}>{cta.label}</Link>
      <div className="xs muted" style={{ marginTop: 6, textAlign: "center" }}>Counts from the rules engine</div>
    </div>
  );
}

function CaseSearch() {
  const { db, user } = useAxon();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!user || user.role === "employee") return null;
  const pool = casesFor(db, user);
  const term = q.trim().toLowerCase();
  const hits = term ? pool.filter((c) => employee(db, c).name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)).slice(0, 6) : [];
  const go = (id: string) => { setQ(""); setOpen(false); router.push(`/cases/${id}`); };
  return (
    <div className="search" ref={ref}>
      <Search size={15} aria-hidden />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search people or case ID…" aria-label="Search people or case ID"
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) go(hits[0].id); if (e.key === "Escape") setOpen(false); }} />
      {open && term && (
        <div className="menu search-menu" role="listbox">
          {hits.length === 0 ? <div className="small muted" style={{ padding: 10 }}>No onboarding matches “{q}”.</div> : hits.map((c) => {
            const e = employee(db, c);
            return <button key={c.id} className="mi" onClick={() => go(c.id)} role="option" aria-selected={false}><Avatar name={e.name} /><span style={{ flex: 1, fontWeight: 640 }}>{e.name}</span><ArrowRight size={14} color="var(--violet)" /></button>;
          })}
        </div>
      )}
    </div>
  );
}

function TopBar({ onMenu, menuOpen, alerts }: { onMenu: () => void; menuOpen: boolean; alerts: number }) {
  const { user, db, login, logout, reset } = useAxon();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!user) return null;

  const groups: { role: Role; ids: string[] }[] = [
    { role: "pmo", ids: ["u-pmo"] },
    { role: "tl", ids: ["u-tl-orion", "u-tl-vega", "u-tl-pulse", "u-tl-nimbus"] },
    { role: "lm", ids: ["u-lm-luca", "u-lm-sara", "u-lm-alex"] },
    { role: "employee", ids: ["u-e-005", "u-e-002", "u-e-006", "u-e-010"] },
    { role: "hr", ids: ["u-hr"] },
    { role: "mgmt", ids: ["u-mgmt"] },
    { role: "core_manager", ids: ["u-cm"] },
    { role: "admin", ids: ["u-admin"] },
  ];

  const pick = (id: string) => {
    const u = db.users.find((x) => x.id === id)!;
    login(id); setOpen(false); router.push(homeFor(u.role));
  };

  return (
    <header className="topbar">
      <button className="btn icon ghost menu-btn" onClick={onMenu} aria-label="Open menu" aria-controls="axon-nav" aria-expanded={menuOpen}><Menu size={20} /></button>
      <div className="crumbs"><span className="crumb-root">AXON <span aria-hidden>/</span></span> <b>{ROLE_LABEL[user.role]}<span className="crumb-view"> view</span></b></div>
      <div className="spacer" />
      <CaseSearch />
      <span className="clock" title="The app clock is fixed to the last date in the starter pack so ages and deadlines are reproducible"><CalendarClock size={14} /><span className="clock-lbl">App clock: </span>14 Oct 2026</span>
      <Link href={homeFor(user.role)} className="btn icon ghost bell" aria-label={`${alerts} items need you`} title={`${alerts} items need you`}>
        <Bell size={18} />{alerts > 0 && <span className="bell-n">{alerts > 99 ? "99+" : alerts}</span>}
      </Link>
      <div style={{ position: "relative" }} ref={ref}>
        <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Signed in as ${user.name}. Switch demo user`}>
          <Avatar name={user.name} dark />
          <ChevronDown size={14} className="user-chev" />
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="row" style={{ padding: "6px 8px 10px" }}>
              <Avatar name={user.name} lg dark />
              <div style={{ minWidth: 0 }}><div className="strong">{user.name}</div><div className="xs muted">{user.title}</div></div>
            </div>
            <div className="divider" style={{ margin: "0 0 4px" }} />
            <div className="mh">Switch demo user</div>
            {groups.map((g) => (
              <div key={g.role}>
                <div className="mh">{ROLE_LABEL[g.role]}</div>
                {g.ids.map((id) => {
                  const u = db.users.find((x) => x.id === id)!;
                  return (
                    <button key={id} className={`mi ${u.id === user.id ? "on" : ""}`} onClick={() => pick(id)} role="menuitem">
                      <Avatar name={u.name} /><span><span style={{ display: "block", fontWeight: 640 }}>{u.name}</span><span className="xs muted">{u.title}</span></span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="divider" />
            <button className="mi" role="menuitem" onClick={() => { setOpen(false); if (confirm("Reset all demo data to the starter pack?")) reset(); }}><RotateCcw size={16} />Reset demo data</button>
            <button className="mi" role="menuitem" onClick={() => { logout(); router.push("/login"); }}><LogOut size={16} />Back to sign-in</button>
          </div>
        )}
      </div>
    </header>
  );
}
