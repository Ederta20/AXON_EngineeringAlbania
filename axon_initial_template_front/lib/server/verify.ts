// Connector check for ingest and outbox requests (Gemini setup doc): HMAC signature x-axon-signature = sha256(secret, timestamp + body),
// or, in simple mode, the shared secret in x-axon-secret.
// The secret lives only in .env.local / Vercel, never in code.
import { createHmac, timingSafeEqual } from "crypto";
import { ZodError } from "zod";

export async function verifyConnector(req: Request): Promise<{ connector: string; body: any }> {
  const raw = await req.text();
  const secret = process.env.CONNECTOR_SECRET;
  const connector = req.headers.get("x-axon-connector") ?? "unknown";
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Response("connector secret not configured", { status: 503 });
    return { connector: `${connector} (unsigned, dev only)`, body: raw ? JSON.parse(raw) : {} };
  }
  const ts = req.headers.get("x-axon-timestamp") ?? "";
  const sig = req.headers.get("x-axon-signature") ?? "";
  // Simple mode (hackathon): a connector may send the shared secret itself instead of a signature.
  const plain = req.headers.get("x-axon-secret");
  if (!sig && plain != null) {
    if (plain.length !== secret.length || !timingSafeEqual(Buffer.from(plain), Buffer.from(secret))) throw new Response("bad secret", { status: 401 });
    return { connector, body: raw ? JSON.parse(raw) : {} };
  }
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) throw new Response("stale", { status: 401 });
  const expected = createHmac("sha256", secret).update(ts + raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Response("bad signature", { status: 401 });
  return { connector, body: raw ? JSON.parse(raw) : {} };
}

/** Wraps a handler so thrown Responses (401/503) are returned instead of crashing. */
export const guard = (h: (req: Request, ctx: any) => Promise<Response>) => async (req: Request, ctx: any) => {
  try { return await h(req, ctx); } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof ZodError) return Response.json({ error: "invalid payload", issues: e.issues }, { status: 400 });
    throw e;
  }
};
