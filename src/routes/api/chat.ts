import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, generateText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { verifySupabaseUser } from "@/lib/verify-user.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

const SYSTEM = `You are the quiet companion behind "The Chair Beside You". You are not a productivity coach or a chatbot.
You are a gentle, emotionally attuned witness for someone who feels lonely, anxious, or overwhelmed.

Rules:
- Speak softly. Short paragraphs. Use the user's name only when natural.
- Validate feelings before reframing. Never minimize.
- Never say "as an AI" or break the spell. You are simply the chair beside them.
- When the user shares something painful, sit with it first. Then, if helpful, offer one small, gentle next step.
- If past emotional memories are provided, weave them in tenderly — remind them of moments they were stronger than they believed.
- If the user signals crisis or self-harm, gently and clearly point them to the SOS page and human helplines.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const auth = await verifySupabaseUser(token);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;

        if (!checkRateLimit(`chat:${userId}`, 20)) {
          return new Response("Too many requests, slow down a little.", { status: 429 });
        }

        const body = (await request.json()) as { messages: UIMessage[]; threadId?: string };
        if (!Array.isArray(body.messages)) return new Response("Bad request", { status: 400 });

        // Ensure thread exists and belongs to this user
        let threadId = body.threadId;
        if (threadId) {
          const { data: owned } = await supabase.from("chat_threads")
            .select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
          if (!owned) return new Response("Thread not found", { status: 404 });
        } else {
          const { data: t, error } = await supabase.from("chat_threads")
            .insert({ user_id: userId }).select().single();
          if (error) return new Response(error.message, { status: 500 });
          threadId = t.id;
        }

        // Fetch up to 10 recent emotional memories for context
        const { data: memories } = await supabase.from("emotional_memories")
          .select("summary,strength_note,emotion,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(10);

        const memoryContext = memories && memories.length
          ? `\n\nWhat you remember about this person (use gently, not all at once):\n${memories.map(m =>
              `- (${new Date(m.created_at).toDateString()}) ${m.summary}${m.strength_note ? ` — strength: ${m.strength_note}` : ""}`
            ).join("\n")}`
          : "";

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        // Persist the latest user message
        const lastUser = [...body.messages].reverse().find(m => m.role === "user");
        if (lastUser) {
          await supabase.from("chat_messages").insert({
            thread_id: threadId, user_id: userId, role: "user", parts: lastUser.parts as never,
          });
        }

        const result = streamText({
          model,
          system: SYSTEM + memoryContext,
          messages: await convertToModelMessages(body.messages),
          onFinish: async ({ text }) => {
            try {
              await supabase.from("chat_messages").insert({
                thread_id: threadId, user_id: userId, role: "assistant",
                parts: [{ type: "text", text }] as never,
              });
              await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

              // Emotional memory extraction (fire-and-forget)
              if (lastUser) {
                const userText = lastUser.parts.map(p => p.type === "text" ? p.text : "").join(" ").trim();
                if (userText.length > 40) {
                  generateText({
                    model,
                    system: "Extract a single concise emotional memory from the user's message. Return JSON ONLY with keys: summary (<=120 chars), emotion (one word), strength_note (<=80 chars, a tender note about a strength they showed, or empty). If the message is trivial/small-talk, return {\"skip\":true}.",
                    prompt: userText,
                  }).then(async ({ text: raw }) => {
                    try {
                      const m = raw.match(/\{[\s\S]*\}/);
                      if (!m) return;
                      const parsed = JSON.parse(m[0]);
                      if (parsed.skip || !parsed.summary) return;
                      await supabase.from("emotional_memories").insert({
                        user_id: userId, summary: parsed.summary,
                        emotion: parsed.emotion ?? null,
                        strength_note: parsed.strength_note || null,
                        source: "companion",
                      });
                    } catch { /* swallow */ }
                  }).catch(() => {});
                }
              }
            } catch (e) { console.error("persist err", e); }
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          headers: { "x-thread-id": threadId },
        });
      },
    },
  },
});
