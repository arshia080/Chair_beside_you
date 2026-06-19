import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildPlan, listPlans } from "@/lib/coach.functions";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
});

const modes = [
  { v: "interview" as const, title: "Interview", body: "For the conversation that will decide things." },
  { v: "presentation" as const, title: "Presentation", body: "For the room that will be watching you." },
  { v: "viva" as const, title: "Viva", body: "For defending what you already know." },
  { v: "meeting" as const, title: "Meeting", body: "For the moment your voice matters." },
];

function CoachPage() {
  const qc = useQueryClient();
  const callList = useServerFn(listPlans);
  const callBuild = useServerFn(buildPlan);

  const q = useQuery({ queryKey: ["plans"], queryFn: () => callList() });

  const [mode, setMode] = useState<"interview" | "presentation" | "viva" | "meeting">("interview");
  const [ctx, setCtx] = useState("");

  const build = useMutation({
    mutationFn: () => callBuild({ data: { mode, context: ctx } }),
    onSuccess: () => { setCtx(""); qc.invalidateQueries({ queryKey: ["plans"] }); },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 pb-20 pt-4">
      <header className="text-center mb-10 animate-fade-up">
        <p className="eyebrow mb-3">Confidence Coach</p>
        <h1 className="font-serif text-5xl md:text-6xl">A plan for the room ahead.</h1>
        <p className="mt-4 text-muted-foreground italic font-serif">Not "be confident". Something gentler, and actually useful.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {modes.map((m) => (
          <button key={m.v} onClick={() => setMode(m.v)}
                  className={`text-left p-5 rounded-2xl transition ${mode === m.v ? "bg-ink text-canvas" : "glass hover:bg-muted"}`}>
            <p className="font-serif text-xl mb-1">{m.title}</p>
            <p className={`text-xs leading-relaxed ${mode === m.v ? "text-canvas/60" : "text-muted-foreground"}`}>{m.body}</p>
          </button>
        ))}
      </div>

      <div className="glass rounded-[2rem] p-6 md:p-10 mb-12 animate-fade-up">
        <p className="eyebrow mb-3">Tell me about it</p>
        <textarea value={ctx} onChange={(e) => setCtx(e.target.value)}
                  rows={5} placeholder="The role, the topic, who's in the room, what you're most worried about..."
                  className="w-full p-5 rounded-2xl bg-canvas/50 border border-border focus:outline-none focus:ring-2 focus:ring-sage resize-none" />
        <div className="flex justify-end mt-5">
          <button onClick={() => build.mutate()} disabled={!ctx.trim() || build.isPending}
                  className="px-8 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] disabled:opacity-30">
            {build.isPending ? "Thinking with you..." : "Build my plan"}
          </button>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="eyebrow">Plans you've made</h2>
        {q.data?.map((p) => (
          <article key={p.id} className="glass rounded-3xl p-6 md:p-8 animate-fade-up">
            <div className="flex justify-between mb-4">
              <p className="eyebrow">{p.mode} · {new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
            </div>
            <p className="text-sm italic text-muted-foreground mb-5">{p.context}</p>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap font-serif text-ink/90 leading-relaxed">{p.plan}</div>
          </article>
        ))}
        {q.data && q.data.length === 0 && (
          <p className="text-center italic font-serif text-muted-foreground py-8">No plans yet. Whenever you're ready.</p>
        )}
      </section>
    </div>
  );
}
