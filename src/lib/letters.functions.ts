import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { checkRateLimit } from "./rate-limit.server";

export const listLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("future_letters").select("*")
      .eq("user_id", context.userId).order("deliver_at", { ascending: true });
    if (error) throw error;
    return data;
  });

export const createLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    content: z.string().min(1).max(8000),
    deliver_at: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("future_letters").insert({
      user_id: context.userId, content: data.content, deliver_at: data.deliver_at,
    }).select().single();
    if (error) throw error;
    return row;
  });

export const generateEncouragement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ feeling: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!checkRateLimit(`letters:${context.userId}`, 5)) throw new Error("Too many requests, take a breath and try again in a minute.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI unavailable");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: "Write a short, tender letter (under 180 words) to the writer's future self. First person, written by their present self. Warm, specific, never preachy. No bullet points. Start with 'Dear future me,' on its own line.",
      prompt: `What I'm feeling now: ${data.feeling}`,
    });
    return { content: text.trim() };
  });
