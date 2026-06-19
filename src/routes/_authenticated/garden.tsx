import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listGarden, plantAction } from "@/lib/garden.functions";

export const Route = createFileRoute("/_authenticated/garden")({
  component: GardenPage,
});

const kinds = [
  { v: "flower" as const, label: "Flower", glyph: "✿", note: "a small brave moment" },
  { v: "tree" as const, label: "Tree", glyph: "⚘", note: "a sustained act of courage" },
  { v: "star" as const, label: "Star", glyph: "✦", note: "a milestone you'll remember" },
];

function GardenPage() {
  const qc = useQueryClient();
  const callList = useServerFn(listGarden);
  const callPlant = useServerFn(plantAction);
  const q = useQuery({ queryKey: ["garden"], queryFn: () => callList() });

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"flower" | "tree" | "star">("flower");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const plant = useMutation({
    mutationFn: () => callPlant({ data: { kind, title, description: desc || undefined } }),
    onSuccess: () => { setTitle(""); setDesc(""); setOpen(false); qc.invalidateQueries({ queryKey: ["garden"] }); },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20 pt-4">
      <header className="text-center mb-10 animate-fade-up">
        <p className="eyebrow mb-3">Confidence Garden</p>
        <h1 className="font-serif text-5xl md:text-6xl">What grew this week?</h1>
        <p className="mt-4 text-muted-foreground italic font-serif">Every brave thing — every small one — plants something here.</p>
      </header>

      <div className="text-center mb-10">
        <button onClick={() => setOpen(true)}
                className="px-8 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] hover:opacity-90">
          + Plant something
        </button>
      </div>

      <div className="glass rounded-[2.5rem] p-8 md:p-16 min-h-[400px] relative overflow-hidden animate-fade-up"
           style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--amber-soft) 30%, var(--canvas)) 0%, color-mix(in oklab, var(--sage) 15%, var(--canvas)) 100%)" }}>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-ink/10" />
        {q.data && q.data.length === 0 && (
          <p className="text-center font-serif italic text-muted-foreground py-20">The soil is ready when you are.</p>
        )}
        <div className="flex flex-wrap justify-center items-end gap-6 min-h-[300px] pt-12">
          {q.data?.map((g, i) => {
            const size = g.kind === "tree" ? "text-7xl" : g.kind === "star" ? "text-5xl" : "text-4xl";
            return (
              <div key={g.id} className="group relative animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`${size} transition-transform group-hover:scale-110 cursor-default`}
                     style={{ color: g.kind === "star" ? "#C9A84C" : g.kind === "tree" ? "#4a6741" : "#C44569" }}>
                  {kinds.find(k => k.v === g.kind)?.glyph}
                </div>
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-ink text-canvas text-xs text-center pointer-events-none transition">
                  <p className="font-serif italic mb-1">{g.title}</p>
                  <p className="text-[10px] opacity-60">{new Date(g.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-canvas rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow mb-3">Plant a brave action</p>
            <h2 className="font-serif text-3xl mb-6">What did you do?</h2>

            <div className="flex gap-2 mb-5">
              {kinds.map((k) => (
                <button key={k.v} onClick={() => setKind(k.v)}
                        className={`flex-1 p-3 rounded-2xl border transition ${kind === k.v ? "border-ink bg-muted" : "border-border"}`}>
                  <div className="text-2xl mb-1">{k.glyph}</div>
                  <div className="text-[10px] uppercase tracking-widest">{k.label}</div>
                </button>
              ))}
            </div>

            <input value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="e.g. spoke up in the meeting"
                   className="w-full px-4 py-3 rounded-2xl glass mb-3" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                      placeholder="A few more words, if you'd like" rows={3}
                      className="w-full px-4 py-3 rounded-2xl glass mb-5 resize-none" />

            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground">Not now</button>
              <button onClick={() => plant.mutate()} disabled={!title.trim() || plant.isPending}
                      className="px-6 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] disabled:opacity-30">
                {plant.isPending ? "..." : "Plant it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
