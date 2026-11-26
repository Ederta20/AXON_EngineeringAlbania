import { TODAY } from "./seed";

const MS = 86_400_000;
export const toDate = (s: string) => new Date(s.slice(0, 10) + "T00:00:00Z");
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS);
export const daysAgo = (s: string, today = TODAY) => daysBetween(s, today);
export const addDays = (s: string, n: number) => new Date(toDate(s).getTime() + n * MS).toISOString().slice(0, 10);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(s: string | null | undefined, withYear = false) {
  if (!s) return "Not set";
  const d = toDate(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? " " + d.getUTCFullYear() : ""}`;
}
export function relDays(s: string, today = TODAY) {
  const d = daysBetween(s, today);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d > 1) return `${d} days ago`;
  if (d === -1) return "tomorrow";
  return `in ${-d} days`;
}
