import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listGarden = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("garden_actions").select("*")
      .eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const plantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    kind: z.enum(["flower", "tree", "star"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("garden_actions").insert({
      user_id: context.userId, title: data.title, description: data.description ?? null, kind: data.kind,
    }).select().single();
    if (error) throw error;

    await context.supabase.from("emotional_memories").insert({
      user_id: context.userId,
      summary: `Brave action: ${data.title}`,
      strength_note: `You did it. ${data.title}.`,
      emotion: "brave", source: "garden",
    });

    return row;
  });
