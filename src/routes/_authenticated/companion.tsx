import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, listMessages, listThreads } from "@/lib/companion.functions";

export const Route = createFileRoute("/_authenticated/companion")({
  component: CompanionPage,
});

function CompanionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callListThreads = useServerFn(listThreads);
  const callCreateThread = useServerFn(createThread);
  const callDeleteThread = useServerFn(deleteThread);
  const callListMessages = useServerFn(listMessages);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => callListThreads() });

  useEffect(() => {
    if (!activeId && threadsQ.data && threadsQ.data.length > 0) setActiveId(threadsQ.data[0].id);
  }, [activeId, threadsQ.data]);

  const newThread = async () => {
    const t = await callCreateThread({ data: {} });
    await qc.invalidateQueries({ queryKey: ["threads"] });
    setActiveId(t.id);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto px-4 gap-4">
      <aside className="hidden md:flex flex-col w-72 glass rounded-3xl p-4 overflow-hidden">
        <button onClick={newThread}
                className="w-full mb-4 py-3 rounded-2xl bg-ink text-canvas text-[10px] uppercase tracking-[0.25em] hover:opacity-90 transition">
          + Begin again
        </button>
        <p className="eyebrow px-2 mb-2">Past conversations</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {threadsQ.data?.map((t) => (
            <div key={t.id}
                 className={`group flex items-center rounded-xl ${activeId === t.id ? "bg-sage/15" : "hover:bg-muted"}`}>
              <button onClick={() => setActiveId(t.id)}
                      className="flex-1 text-left px-3 py-3 text-sm truncate">
                <p className="font-serif italic truncate">{t.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(t.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </button>
              <button onClick={async () => {
                if (!confirm("Release this conversation?")) return;
                await callDeleteThread({ data: { id: t.id } });
                await qc.invalidateQueries({ queryKey: ["threads"] });
                if (activeId === t.id) setActiveId(null);
              }} className="opacity-0 group-hover:opacity-60 hover:opacity-100 px-3 text-xs">×</button>
            </div>
          ))}
          {threadsQ.data?.length === 0 && (
            <p className="px-3 text-xs italic text-muted-foreground">No conversations yet. The first one begins now.</p>
          )}
        </div>
        <button onClick={() => navigate({ to: "/sos" })}
                className="mt-3 py-3 rounded-2xl border border-destructive/30 text-destructive text-[10px] uppercase tracking-[0.25em] hover:bg-destructive/5">
          I need help now
        </button>
      </aside>

      <main className="flex-1 glass rounded-3xl overflow-hidden flex flex-col">
        {activeId && token ? (
          <ChatWindow key={activeId} threadId={activeId} token={token} loadMessages={() => callListMessages({ data: { threadId: activeId } })} />
        ) : (
          <EmptyChair onStart={newThread} />
        )}
      </main>
    </div>
  );
}

function EmptyChair({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <p className="eyebrow mb-4">The chair is here</p>
      <h2 className="font-serif text-4xl md:text-5xl italic mb-6">Shall we sit together?</h2>
      <p className="max-w-md text-muted-foreground mb-8">
        Whatever's on your chest — heavy, small, confused, ordinary — there's space for it here.
      </p>
      <button onClick={onStart} className="px-10 py-4 bg-ink text-canvas rounded-full text-xs uppercase tracking-[0.25em]">
        Begin
      </button>
    </div>
  );
}

type DbMsg = { id: string; role: string; parts: unknown; created_at: string };

function ChatWindow({ threadId, token, loadMessages }: { threadId: string; token: string; loadMessages: () => Promise<DbMsg[]> }) {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    loadMessages().then((rows) => {
      setInitial(rows.map((r) => ({
        id: r.id, role: r.role as "user" | "assistant",
        parts: Array.isArray(r.parts) ? r.parts as UIMessage["parts"] : [{ type: "text", text: String(r.parts) }],
      } as UIMessage)));
    });
  }, [threadId, loadMessages]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: () => ({ Authorization: `Bearer ${token}` }),
    body: () => ({ threadId }),
  }), [threadId, token]);

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial ?? [],
    transport,
  });

  useEffect(() => { inputRef.current?.focus(); }, [threadId, status]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  if (!initial) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm italic">Settling in...</div>;

  const busy = status === "submitted" || status === "streaming";

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-12 py-8 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="font-serif italic text-2xl text-muted-foreground">Whenever you're ready.</p>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts.map((p) => p.type === "text" ? p.text : "").join("");
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end animate-fade-up">
                <div className="max-w-[80%] px-5 py-3 rounded-3xl rounded-tr-md bg-ink text-canvas text-[15px] leading-relaxed whitespace-pre-wrap">{text}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className="max-w-[85%] animate-fade-up">
              <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-ink/90 font-serif">{text}</p>
            </div>
          );
        })}
        {busy && <p className="text-sm italic text-muted-foreground animate-pulse">listening...</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input.trim() });
          setInput("");
        }}
        className="border-t border-border p-4 md:p-6 flex gap-3 items-end"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !busy) { sendMessage({ text: input.trim() }); setInput(""); }
            }
          }}
          rows={1}
          placeholder="Say anything. Or nothing at all."
          className="flex-1 resize-none px-5 py-4 rounded-2xl bg-canvas/50 border border-border focus:outline-none focus:ring-2 focus:ring-sage text-[15px] font-serif italic placeholder:text-muted-foreground/60 max-h-40"
        />
        <button type="submit" disabled={busy || !input.trim()}
                className="size-12 rounded-full bg-ink text-canvas flex items-center justify-center disabled:opacity-30 hover:scale-105 transition">
          →
        </button>
      </form>
    </>
  );
}
