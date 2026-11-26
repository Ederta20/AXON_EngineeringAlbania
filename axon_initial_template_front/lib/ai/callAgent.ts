// The only file that talks to Gemini. Every agent calls callAgent().
import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { aiCache, audit } from "@/lib/server/db";

export class AgentError extends Error {
  constructor(public agent: string, public cause: unknown) {
    super(`Agent ${agent} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "AgentError";
  }
}

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" }));

const isRateLimit = (e: any) => e?.status === 429 || /RESOURCE_EXHAUSTED|429/.test(String(e?.message ?? e));
// Overloaded, timed out or aborted: switch to the fallback model.
const isOverloaded = (e: any) => [503, 504].includes(e?.status) || /UNAVAILABLE|DEADLINE_EXCEEDED|"code":50[34]|abort|timeout/i.test(String(e?.message ?? e) + (e?.name ?? ""));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callAgent<T>(system: string, input: string, schema: object, opts: { agent: string; inputIds?: string[] }): Promise<T> {
  const key = createHash("sha256").update(opts.agent + system + input).digest("hex");
  const useCache = process.env.AI_CACHE === "on";
  if (useCache) {
    const hit = aiCache.get(key);
    if (hit !== undefined) return hit as T;
  }

  let model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";
  const run = async (timeout: number) => {
    const r = await ai().models.generateContent({
      model,
      contents: input,
      config: { httpOptions: { timeout }, systemInstruction: system, responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    });
    return JSON.parse(r.text ?? "") as T;
  };

  let output: T;
  try {
    try {
      output = await run(20_000);
    } catch (e) {
      if (!isRateLimit(e) && !isOverloaded(e)) throw e;
      if (isRateLimit(e)) await sleep(15_000);
      else model = fallback; // main model overloaded: use the lighter one
      output = await run(45_000);
    }
  } catch (e) {
    throw new AgentError(opts.agent, e);
  }

  if (useCache) aiCache.upsert(key, output);
  audit(`agent:${opts.agent}`, "ai_call", { model, inputIds: opts.inputIds ?? [] });
  return output;
}
