import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listVictories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("victories").select("*")
      .eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const addVictory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1).max(160),
    note: z.string().max(2000).optional(),
    image_url: z.string().url().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("victories").insert({
      user_id: context.userId, title: data.title,
      note: data.note ?? null, image_url: data.image_url ?? null,
    }).select().single();
    if (error) throw error;

    await context.supabase.from("emotional_memories").insert({
      user_id: context.userId, summary: `Victory: ${data.title}`,
      strength_note: data.title, emotion: "proud", source: "vault",
    });
    return row;
  });

export const deleteVictory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("victories").delete()
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
