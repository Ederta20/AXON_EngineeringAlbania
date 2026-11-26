"use client";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import {
  Flag, Users, ShieldCheck, Route, LayoutDashboard, KeyRound, MessageSquareText, BookOpen, Puzzle, BarChart3, Search,
  UserPlus, Settings2, FileText, ChevronDown, RotateCcw, CalendarClock, LogOut,
} from "lucide-react";
import { useAxon } from "@/lib/store";
import type { Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";
import { Avatar } from "./ui";
import { openFlags } from "@/lib/selectors";

type NavItem = { href: string; label: string; icon: LucideIcon; tier?: "Extra"; count?: number };

export function homeFor(role: Role) {
  return ({ pmo: "/flags", tl: "/validation", lm: "/people", employee: "/path", hr: "/starts", mgmt: "/overview", core_manager: "/requirements", admin: "/config" } as const)[role];
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, db, ready } = useAxon();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  if (!ready || !user) return null;

  const flagsOpen = openFlags(db).length;
  const pendingVal = db.validations.filter((v) => !v.decided_level && v.tl_id === user.id).length;
  const pendingReq = db.client_requirements.filter((r) => r.status === "submitted").length;

  const NAV: Record<Role, NavItem[]> = {
    pmo: [
      { href: "/flags", label: "Flags board", icon: Flag, count: flagsOpen },
      { href: "/people", label: "All onboardings", icon: Users },
      { href: "/benchmarks", label: "Paths and benchmarks", icon: Route, tier: "Extra" },
      { href: "/root-cause", label: "Root causes", icon: Search, tier: "Extra" },
    ],
    tl: [
      { href: "/validation", label: "Validation queue", icon: ShieldCheck, count: pendingVal },
      { href: "/people", label: "My people", icon: Users },
      { href: "/skills", label: "Skills and docs", icon: BookOpen, tier: "Extra" },
      { href: "/challenges", label: "Skill challenges", icon: Puzzle, tier: "Extra" },
    ],
    lm: [{ href: "/people", label: "My people", icon: Users }],
    employee: [
      { href: "/path", label: "My path", icon: Route },
      { href: "/access", label: "My access", icon: KeyRound },
      { href: "/checkin", label: "Check-in and feedback", icon: MessageSquareText },
      { href: "/skills", label: "Skills and docs", icon: BookOpen, tier: "Extra" },
      { href: "/challenges", label: "Skill challenges", icon: Puzzle, tier: "Extra" },
    ],
    hr: [
      { href: "/starts", label: "Starts and movements", icon: UserPlus, tier: "Extra" },
      { href: "/people", label: "All onboardings", icon: Users },
    ],
    mgmt: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/root-cause", label: "Root causes", icon: BarChart3, tier: "Extra" },
      { href: "/people", label: "All onboardings", icon: Users },
    ],
    core_manager: [
      { href: "/requirements", label: "Requirements assistant", icon: FileText },
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
    ],
    admin: [
      { href: "/config", label: "Configuration", icon: Settings2, tier: "Extra", count: pendingReq },
      { href: "/flags", label: "Flags board", icon: Flag },
    ],
  };

  const items = NAV[user.role];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 14 8 2l6 12M4.6 9h6.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><div className="brand-name">AXON</div><div className="brand-sub">Onboarding and KT</div></div>
        </div>
        <nav className="nav-group" aria-label="Main">
          <div className="nav-label">{ROLE_LABEL[user.role]}</div>
          {items.map((it) => {
            const active = path === it.href || (it.href !== "/" && path.startsWith(it.href + "/"));
            const Ic = it.icon;
            return (
              <Link key={it.href} href={it.href} className={`nav-item ${active ? "active" : ""}`}>
                <Ic size={17} />{it.label}
                {it.count ? <span className="count">{it.count}</span> : it.tier ? <span className="nav-tier">{it.tier}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div style={{ fontWeight: 650, color: "#fff", marginBottom: 4 }}>Where people act</div>
          Most actions go out as one Teams card or Outlook email. AXON never reads mailboxes: connectors send structured evidence only.
        </div>
      </aside>
      <div className="main">
        <TopBar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function TopBar() {
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
      <div className="crumbs">AXON <span aria-hidden>/</span> <b>{ROLE_LABEL[user.role]} view</b></div>
      <div className="spacer" />
      <span className="clock" title="The app clock is fixed to the last date in the starter pack so ages and deadlines are reproducible"><CalendarClock size={14} />App clock: 14 Oct 2026</span>
      <button className="btn sm ghost" onClick={() => { if (confirm("Reset all demo data to the starter pack?")) reset(); }} title="Reset demo data"><RotateCcw size={14} />Reset demo</button>
      <div style={{ position: "relative" }} ref={ref}>
        <button className="btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} style={{ height: 40, paddingLeft: 6 }}>
          <Avatar name={user.name} dark />
          <span style={{ textAlign: "left", lineHeight: 1.2 }}><span style={{ display: "block", fontWeight: 680 }}>{user.name}</span><span className="xs muted" style={{ fontWeight: 560 }}>{user.title}</span></span>
          <ChevronDown size={15} />
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="mh">Switch demo user</div>
            {groups.map((g) => (
              <div key={g.role}>
                <div className="mh">{ROLE_LABEL[g.role]}</div>
                {g.ids.map((id) => {
                  const u = db.users.find((x) => x.id === id)!;
                  return (
                    <button key={id} className="mi" onClick={() => pick(id)} role="menuitem" style={u.id === user.id ? { background: "rgba(89,53,175,.08)" } : undefined}>
                      <Avatar name={u.name} /><span><span style={{ display: "block", fontWeight: 640 }}>{u.name}</span><span className="xs muted">{u.title}{u.case_id ? ` · ${u.case_id}` : ""}</span></span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="divider" />
            <button className="mi" onClick={() => { logout(); router.push("/login"); }}><LogOut size={16} />Back to sign-in</button>
          </div>
        )}
      </div>
    </header>
  );
}
