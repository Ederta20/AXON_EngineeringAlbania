// The one place AXON talks to a language model. Server only: never import this from a client component.
//
// Every agent route calls callAgent() with a zod schema for its output and a mock fallback.
//   - No GEMINI_API_KEY, or generate() not implemented yet  -> returns the mock, source "mock".
//   - Model output fails the schema                         -> one retry with the error, then the mock with status "needs_review".
//   - Model output passes                                   -> source "ai", status "ok".
// So the demo never breaks, and routes never need to know whether the answer came from a model.
//
// TO IMPLEMENT THE AGENTS: fill in generate() below, then write the prompts in lib/ai/prompts.ts. Nothing else has to change.
import type { ZodType } from "zod";

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
}

export interface AgentResult<T> {
  output: T;
  source: "ai" | "mock";
  status: "ok" | "needs_review";
  model: string;           // written to audit_log.model
  agent: string;           // written to audit_log.agent
}

class NotImplemented extends Error {}

/**
 * Calls the model and returns its raw text, which must be a JSON object.
 * TODO(agents): implement with the Gemini SDK or REST API, for example:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent
 *   header x-goog-api-key: process.env.GEMINI_API_KEY
 *   body { systemInstruction: { parts: [{ text: system }] },
 *          contents: [{ role: "user", parts: [{ text: user }] }],
 *          generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }
 *   return data.candidates[0].content.parts[0].text
 */
async function generate(system: string, user: string, model: string): Promise<string> {
  void system; void user; void model;
  throw new NotImplemented("generate() is not implemented yet");
}

/** Small model for A1, A5, A6; larger for A2, A3, A9 (brief, Part 5). Override per agent with env vars if needed. */
function modelFor(agent: AgentId) {
  const small = process.env.GEMINI_MODEL_SMALL ?? process.env.GEMINI_MODEL ?? "gemini-flash";
  const large = process.env.GEMINI_MODEL ?? small;
  return ["A1", "A5", "A6"].includes(agent) ? small : large;
}

export async function callAgent<T>(call: AgentCall<T>): Promise<AgentResult<T>> {
  const agent = AGENT_NAMES[call.agent];
  const mock = (status: "ok" | "needs_review"): AgentResult<T> => ({ output: call.fallback(), source: "mock", status, model: "mock", agent });
  if (!process.env.GEMINI_API_KEY) return mock("ok");

  const model = modelFor(call.agent);
  let user = JSON.stringify(call.input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generate(call.system, user, model);
      const parsed = call.schema.safeParse(JSON.parse(raw));
      if (parsed.success) return { output: parsed.data, source: "ai", status: "ok", model, agent };
      user = `${JSON.stringify(call.input)}\n\nYour previous answer did not match the required JSON schema: ${parsed.error.message}. Answer again with valid JSON only.`;
    } catch (e) {
      if (e instanceof NotImplemented) return mock("ok");
      console.error(`${agent} call failed`, e);
    }
  }
  return mock("needs_review"); // invalid twice: keep the demo running, mark for a person to check
}
