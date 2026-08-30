import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { checkRateLimit } from "./rate-limit.server";

const Mode = z.enum(["interview", "presentation", "viva", "meeting"]);

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("confidence_plans").select("*")
      .eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const buildPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: Mode, context: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!checkRateLimit(`coach:${context.userId}`, 5)) throw new Error("Too many requests, take a breath and try again in a minute.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI unavailable");

    const gateway = createLovableAiGatewayProvider(key);
    const system = `You are a calm, warm confidence coach. The user is preparing for a ${data.mode}. Produce a personalized plan that feels human, not corporate. Structure:

1) One-paragraph reframe of what's actually scary.
2) "The night before" — 3 short rituals.
3) "An hour before" — 3 grounding moves.
4) "In the room" — 3 reminders.
5) "Afterward" — 2 things to do, regardless of how it went.

Use markdown headings. Be specific. Avoid clichés. Never tell them to "just be confident".`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt: data.context,
    });

    const { data: row, error } = await context.supabase.from("confidence_plans").insert({
      user_id: context.userId, mode: data.mode, context: data.context, plan: text.trim(),
    }).select().single();
    if (error) throw error;
    return row;
  });
