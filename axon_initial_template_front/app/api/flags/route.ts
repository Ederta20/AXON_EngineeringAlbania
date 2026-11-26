// GET /api/flags?status=open -> v_flags_board (C2): open flags with case, owner, age and cause
import { getDb, json } from "@/lib/server/db";
import { daysAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? "open";
  const db = await getDb();
  return json(db.flags.filter((f) => status === "all" || f.status === status).map((f) => {
    const c = db.cases.find((x) => x.id === f.case_id)!;
    return { ...f, age_days: daysAgo(f.raised_at), employee: db.users.find((u) => u.id === c.employee_id)?.name, project_id: c.project_id };
  }));
}
