"use client";
import React, { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Ban, Clock, GitCompareArrows, Hourglass, KeyRound, Lock, LockOpen, MailQuestion, CalendarX2, FileWarning,
  Gauge, ShieldCheck, Sparkles, X, Inbox, Check, Building2, Scale, Circle,
} from "lucide-react";
import type { AccessState, Band, Flag, FlagType, ScopeLevel, Severity, Stage } from "@/lib/types";
import { ACCESS_LABEL, BAND_LABEL, FLAG_LABEL, LEVELS, LEVEL_LABEL, SEVERITY_LABEL, STAGE_LABEL, OUTCOME_LABEL } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";

export const FLAG_ICON: Record<FlagType, LucideIcon> = {
  blocked: Ban, stale: Hourglass, conflict: GitCompareArrows, at_risk: AlertTriangle, unanswered: MailQuestion, missing_info: FileWarning,
  access_delay: KeyRound, date_mismatch: CalendarX2, client_requirement: Building2, rating_gap: Scale,
};

export function Card({ title, sub, action, children, className = "", pad = true, id }: { title?: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <div className="card-head">
          <div>{title && <h2>{title}</h2>}{sub && <div className="sub">{sub}</div>}</div>
          {action}
        </div>
      )}
      <div className={pad ? "card-body" : ""}>{children}</div>
    </section>
  );
}

export function PageHead({ title, question, right }: { title: string; question?: string; right?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{question && <p className="q">{question}</p>}</div>
      {right}
    </div>
  );
}

/** The top of every screen says what action is needed. */
export function Needed({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="needed" role="status">
      <div className="grow">
        <div className="lbl"><Sparkles size={15} />Action needed</div>
        <div className="txt">{children}</div>
      </div>
      {action && <div className="needed-act">{action}</div>}
      <Crystal />
    </div>
  );
}

/** Decorative glass crystal for hero banners (pure SVG, palette colors). */
export function Crystal({ className = "crystal" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 200" aria-hidden focusable="false">
      <defs>
        <linearGradient id="cx-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><stop offset="1" stopColor="#B9A6EE" stopOpacity=".55" /></linearGradient>
        <linearGradient id="cx-b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8261D1" stopOpacity=".85" /><stop offset="1" stopColor="#354ED8" stopOpacity=".55" /></linearGradient>
        <linearGradient id="cx-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5935AF" stopOpacity=".9" /><stop offset="1" stopColor="#301B69" stopOpacity=".75" /></linearGradient>
        <radialGradient id="cx-g" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".9" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="128" cy="112" rx="104" ry="30" fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="1.2" transform="rotate(-12 128 112)" />
      <ellipse cx="128" cy="112" rx="84" ry="22" fill="none" stroke="#8261D1" strokeOpacity=".35" strokeWidth="1" transform="rotate(-12 128 112)" />
      <circle cx="128" cy="96" r="70" fill="url(#cx-g)" opacity=".7" />
      <polygon points="128,18 178,70 128,176" fill="url(#cx-b)" />
      <polygon points="128,18 78,70 128,176" fill="url(#cx-a)" />
      <polygon points="78,70 128,92 178,70 128,176" fill="url(#cx-c)" opacity=".55" />
      <polygon points="128,18 78,70 128,92 178,70" fill="#FFFFFF" opacity=".35" />
      <polyline points="78,70 128,92 178,70" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.2" />
      <line x1="128" y1="92" x2="128" y2="176" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1" />
      <path d="M128 18 L178 70 L128 176 L78 70 Z" fill="none" stroke="#FFFFFF" strokeOpacity=".9" strokeWidth="1.4" strokeLinejoin="round" />
      <g fill="#FFFFFF"><path d="M206 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" opacity=".9" /><path d="M46 52l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" opacity=".75" /><path d="M200 146l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity=".7" /></g>
    </svg>
  );
}

export function Stat({ k, v, unit, d, icon }: { k: string; v: React.ReactNode; unit?: string; d?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="k">{icon}{k}</div>
      <div className="v">{v}{unit && <small>{unit}</small>}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

export function FlagTag({ type, severity }: { type: FlagType; severity?: Severity }) {
  const Ic = FLAG_ICON[type];
  return <span className={`tag ${severity ?? "neutral"}`}><Ic size={13} />{FLAG_LABEL[type]}</span>;
}
export function SevTag({ s }: { s: Severity }) {
  const shape = s === "high" ? "▲" : s === "medium" ? "◆" : "●";
  return <span className={`tag ${s}`} title={`Severity ${SEVERITY_LABEL[s]}`}><span aria-hidden style={{ fontSize: 9 }}>{shape}</span>{SEVERITY_LABEL[s]}</span>;
}
export function BandTag({ band, provisional }: { band: Band | null; provisional?: boolean }) {
  if (!band) return <span className="tag outline">No score yet</span>;
  return <span className={`band ${band}`}><i />{BAND_LABEL[band]}{provisional && <span className="tag outline xs" style={{ height: 18 }}>Provisional</span>}</span>;
}
export function StageTag({ stage, outcome }: { stage: Stage; outcome?: string | null }) {
  return <span className="stage"><span className="dot" />{stage === "outcome" && outcome ? `Outcome: ${OUTCOME_LABEL[outcome as keyof typeof OUTCOME_LABEL]}` : STAGE_LABEL[stage]}</span>;
}
export function AiChip({ label = "Proposed by AI", title }: { label?: string; title?: string }) {
  return <span className="ai" title={title ?? "Created by an AXON agent. A person must confirm it."}><Sparkles size={12} />{label}</span>;
}
export function HumanChip({ who, when, label = "Validated" }: { who: string; when?: string | null; label?: string }) {
  return <span className="human"><ShieldCheck size={12} />{label} by {who}{when ? ` · ${fmtDate(when)}` : ""}</span>;
}
export function SimTag() { return <span className="tag sim xs" title="Fictional data added so the demo has enough evidence">Simulated</span>; }

export function LevelStepper({ level, proposed }: { level: ScopeLevel; proposed?: ScopeLevel | null }) {
  const i = LEVELS.indexOf(level);
  const p = proposed ? LEVELS.indexOf(proposed) : -1;
  return (
    <div>
      <div className="stepper" aria-label={`Level ${LEVEL_LABEL[level]}`}>
        {LEVELS.slice(1).map((l, k) => {
          const idx = k + 1;
          const on = idx <= i;
          return <span key={l} className={`${on ? "on" : ""} ${on && level === "validated" ? "v" : ""} ${!on && idx <= p ? "prop" : ""}`} />;
        })}
      </div>
    </div>
  );
}

export function LevelTag({ level }: { level: ScopeLevel }) {
  if (level === "validated") return <span className="tag ok"><ShieldCheck size={12} />Validated</span>;
  if (level === "not_started") return <span className="tag outline"><Circle size={10} />Not started</span>;
  return <span className="tag neutral">{LEVEL_LABEL[level]}</span>;
}

export function AccessPipe({ state }: { state: AccessState }) {
  const steps: AccessState[] = ["requested", "approved", "usable"];
  const i = steps.indexOf(state);
  return (
    <span className="pipe" aria-label={`Access ${ACCESS_LABEL[state]}`}>
      {steps.map((s, k) => (
        <React.Fragment key={s}>
          {k > 0 && <span className="sep" />}
          <span className={`p ${k <= i ? (s === "usable" ? "usable" : "done") : ""}`}>{k <= i && <Check size={11} />}{ACCESS_LABEL[s]}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

export function ScoreRing({ score, band, size = 128, capped, provisional }: { score: number | null; band: Band | null; size?: number; capped?: boolean; provisional?: boolean }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : score / 100;
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(48,27,105,.09)" strokeWidth="9" />
        {/* cap marker at 84 */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(48,27,105,.28)" strokeWidth="9" strokeDasharray={`1.6 ${c}`} strokeDashoffset={-c * 0.84}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FF5B00" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity={provisional ? 0.55 : 1}
          style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="center">
        <div>
          <div className="val">{score ?? "–"}</div>
          <div className="of">{provisional ? "provisional" : capped ? "capped at 84" : "of 100"}</div>
        </div>
      </div>
      <span className="sr-only">{score == null ? "No score yet" : `Readiness ${score} of 100, ${band ? BAND_LABEL[band] : ""}`}</span>
    </div>
  );
}

export function GateChip({ passed, validated, total }: { passed: boolean; validated: number; total: number }) {
  return passed
    ? <span className="gate open"><LockOpen size={13} />TL gate passed</span>
    : <span className="gate locked"><Lock size={13} />Awaiting TL · {validated}/{total} core scopes validated</span>;
}

export function Empty({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="empty"><div className="ic">{icon ?? <Inbox size={18} />}</div><b>{title}</b>{children && <div className="small">{children}</div>}</div>;
}

export function Avatar({ name, lg, dark }: { name: string; lg?: boolean; dark?: boolean }) {
  const ini = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`avatar ${lg ? "lg" : ""} ${dark ? "dark" : ""}`} aria-hidden>{ini}</span>;
}

export function Drawer({ open, onClose, title, sub, children, foot }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 720, color: "var(--midnight)" }}>{title}</div>{sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
          <button className="btn icon ghost" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </aside>
    </>
  );
}

export function Modal({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="drawer-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 720, color: "var(--midnight)" }}>{title}</div>{sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
          <button className="btn icon ghost" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px 22px" }}>{children}</div>
      </div>
    </>
  );
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [msg, onDone]);
  if (!msg) return null;
  return <div className="toast" role="status"><Check size={15} />{msg}</div>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return <div className="seg" role="tablist">{options.map((o) => <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)} role="tab" aria-selected={value === o.v}>{o.label}</button>)}</div>;
}

export function Due({ date }: { date: string }) {
  return <span className="row gap4 nowrap small"><Clock size={12} />{fmtDate(date)}</span>;
}

export function FlagLine({ f }: { f: Flag }) {
  return <span className="row gap6 wrap"><FlagTag type={f.type} severity={f.severity} /><span className="small ink2">{f.detail}</span></span>;
}

export { Gauge };
