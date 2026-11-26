// A5 Reply Listener, in-app trigger. POST /api/agents/reply {action_id, text?}
// Tonight replies are simulated (brief): without text, the seeded demo reply for that flag is used.
import { guard } from "@/lib/server/verify";
import { z } from "zod";
import { getDb, json, notFound } from "@/lib/server/db";
import { REPLIES } from "@/lib/agents";
import { TODAY } from "@/lib/seed";
import { handleReply } from "@/lib/server/reply";

export const maxDuration = 60;

export const POST = guard(async (req: Request) => {
  const b = z.object({ action_id: z.string(), text: z.string().min(2).max(2000).optional() }).parse(await req.json());
  const a = (await getDb()).actions.find((x) => x.id === b.action_id);
  if (!a) return notFound("action");
  const text = b.text ?? REPLIES[a.flag_id]?.summary ?? "Owner acknowledged and will follow up.";
  return json({ simulated: !b.text, ...(await handleReply({ action_id: a.id, text, received_at: TODAY, actor: "agent:A5 Reply Listener" })) });
});
