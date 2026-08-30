import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Talks to Google's Gemini API directly (a GEMINI_API_KEY from
// aistudio.google.com/apikey), replacing the old Lovable AI Gateway proxy.
// gemini-2.5-flash is no longer available to new API keys — Google's own API
// error on that model points new keys at gemini-3.6-flash instead.
export const AI_MODEL = "gemini-3.6-flash";

export function createAiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}
