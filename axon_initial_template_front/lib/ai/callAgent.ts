// The one place AXON talks to a language model. Server only: never import this from a client component.
//
// Every agent route calls callAgent() with a zod schema for its output and a mock fallback.
//   - No GEMINI_API_KEY, or generate() not implemented yet  -> returns the mock, source "mock".
//   - Model output fails the schema                         -> one retry with the error, then the mock with status "needs_review".
//   - Model output passes                                   -> source "ai", status "ok".
// So the demo never breaks, and routes never need to know whether the answer came from a model.
//
// generate() calls Gemini (@google/genai). To make another agent real, write its prompt in lib/ai/prompts.ts:
// prompts that still contain "TODO:" stay on the mock, so a half-written agent never slows the demo down.
import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { aiCache, logAudit } from "@/lib/server/db";

export type AgentId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" | "A10";

export const AGENT_NAMES: Record<AgentId, string> = {
  A1: "A1 Evidence Extractor", A2: "A2 Root-Cause Analyst", A3: "A3 Readiness Assessor", A4: "A4 Next-Action Drafter",
  A5: "A5 Reply Listener", A6: "A6 1:1 Scorer", A7: "A7 Challenge Generator", A8: "A8 Report Writer",
  A9: "A9 Process Improver", A10: "A10 Requirements Assistant",
};

export interface AgentCall<T> {
  agent: AgentId;
  system: string;          // the agent's prompt (lib/ai/prompts.ts)
  input: unknown;          // structured input; serialized as JSON for the model. Numbers and dates come from SQL, never from the model.
  schema: ZodType<T>;      // the output contract; also describe it in the prompt
  fallback: () => T;       // the mock answer used when the model is off or fails
  inputIds?: string[];     // ids of the rows the input was built from (audit_log); collected from the input when omitted
}

/** Every "id" in the input, for the audit row (Gemini setup doc: payload { model, inputIds }). */
const idsIn = (input: unknown) => Array.from(new Set(Array.from(JSON.stringify(input).matchAll(/"id":"([^"]+)"/g), (m) => m[1]))).slice(0, 100);

export interface AgentResult<T> {
  output: T;
  source: "ai" | "mock";
  status: "ok" | "needs_review";
  model: string;           // written to audit_log.model
  agent: string;           // written to audit_log.agent
}

class NotImplemented extends Error {}

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" }));
const errText = (e: any) => String(e?.message ?? e) + (e?.name ?? "");
const isRateLimit = (e: any) => e?.status === 429 || /RESOURCE_EXHAUSTED|"code":429/.test(errText(e));
// Overloaded, timed out or aborted: switch to the fallback model.
const isOverloaded = (e: any) => [503, 504].includes(e?.status) || /UNAVAILABLE|DEADLINE_EXCEEDED|"code":50[34]|abort|timeout/i.test(errText(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini and returns its JSON text plus the model that answered.
 * Rate limit (429), overloaded or slower than 20 s: retry once on GEMINI_FALLBACK_MODEL (if that is rate-limited too, wait 15 s once).
 */
async function generate(system: string, user: string, model: string): Promise<{ text: string; model: string }> {
  const once = async (m: string, timeout: number) => {
    const r = await ai().models.generateContent({
      model: m, contents: user,
      config: { systemInstruction: system, responseMimeType: "application/json", temperature: 0.2, httpOptions: { timeout } },
    });
    if (!r.text) throw new Error("empty model response");
    return { text: r.text, model: m };
  };
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
  try {
    return await once(model, 20_000);
  } catch (e) {
    if (!isRateLimit(e) && !isOverloaded(e)) throw e;
    // Quota used up, overloaded or slow: the lighter model has its own quota, so switch to it.
    const next = model === fallback ? model : fallback;
    try {
      return await once(next, 45_000);
    } catch (e2) {
      if (!isRateLimit(e2)) throw e2;
      await sleep(15_000); // both rate-limited: wait once
      return once(next, 45_000);
    }
  }
}

/** Small model for A1, A5, A6; larger for A2, A3, A9 (brief, Part 5). Override per agent with env vars if needed. */
function modelFor(agent: AgentId) {
  const small = process.env.GEMINI_MODEL_SMALL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const large = process.env.GEMINI_MODEL || small;
  return ["A1", "A5", "A6"].includes(agent) ? small : large;
}

export async function callAgent<T>(call: AgentCall<T>): Promise<AgentResult<T>> {
  const agent = AGENT_NAMES[call.agent];
  const mock = (status: "ok" | "needs_review"): AgentResult<T> => ({ output: call.fallback(), source: "mock", status, model: "mock", agent });
  if (!process.env.GEMINI_API_KEY || call.system.includes("TODO:")) return mock("ok");

  // Same agent + prompt + input -> same answer: serve it from ai_cache (AI_CACHE=on) without calling the model.
  const useCache = process.env.AI_CACHE === "on";
  const key = createHash("sha256").update(call.agent + call.system + JSON.stringify(call.input)).digest("hex");
  if (useCache) {
    const hit = await aiCache.get(key);
    const parsed = hit ? call.schema.safeParse((hit as { output: unknown }).output) : null;
    if (parsed?.success) return { output: parsed.data, source: "ai", status: "ok", model: (hit as { model: string }).model, agent };
  }

  let model = modelFor(call.agent);
  let user = JSON.stringify(call.input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generate(call.system, user, model);
      model = res.model;
      const parsed = call.schema.safeParse(JSON.parse(res.text));
      if (parsed.success) {
        if (useCache) await aiCache.upsert(key, { output: parsed.data, model });
        await logAudit({ actor: `agent:${call.agent}`, action: "ai_call", entity: "agents", entity_id: call.agent, agent, model, payload: { model, inputIds: call.inputIds ?? idsIn(call.input) } });
        return { output: parsed.data, source: "ai", status: "ok", model, agent };
      }
      user = `${JSON.stringify(call.input)}\n\nYour previous answer did not match the required JSON schema: ${parsed.error.message}. Answer again with valid JSON only.`;
    } catch (e) {
      if (e instanceof NotImplemented) return mock("ok");
      console.error(`${agent} call failed:`, e instanceof Error ? e.message : e);
    }
  }
  return mock("needs_review"); // invalid twice: keep the demo running, mark for a person to check
}
