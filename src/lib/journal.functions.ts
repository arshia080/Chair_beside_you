import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { checkRateLimit } from "./rate-limit.server";

export const listEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("journal_entries").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const addEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    content: z.string().min(1).max(8000),
    mood: z.string().max(40).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    let reflection: string | null = null;
    if (key && checkRateLimit(`journal:${context.userId}`, 10)) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: "You are a tender, emotionally attuned witness. In 2-3 short sentences, reflect what the writer might be feeling underneath their words. Be warm, never clinical. Do not advise. Do not start with 'I' or 'It sounds like'.",
          prompt: data.content,
        });
        reflection = text.trim();
      } catch (e) { console.error("reflection error", e); }
    }

    const { data: row, error } = await context.supabase.from("journal_entries").insert({
      user_id: context.userId, content: data.content,
      mood: data.mood ?? null, ai_reflection: reflection,
    }).select().single();
    if (error) throw error;

    // Memory
    try {
      await context.supabase.from("emotional_memories").insert({
        user_id: context.userId,
        summary: data.content.slice(0, 120),
        emotion: data.mood ?? null,
        source: "journal",
      });
    } catch { /* */ }

    return row;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("journal_entries").delete()
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
