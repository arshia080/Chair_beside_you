import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLetter, generateEncouragement, listLetters } from "@/lib/letters.functions";

export const Route = createFileRoute("/_authenticated/letters")({
  component: LettersPage,
});

function LettersPage() {
  const qc = useQueryClient();
  const callList = useServerFn(listLetters);
  const callCreate = useServerFn(createLetter);
  const callGen = useServerFn(generateEncouragement);

  const q = useQuery({ queryKey: ["letters"], queryFn: () => callList() });

  const defaultDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [content, setContent] = useState("");
  const [deliverAt, setDeliverAt] = useState(defaultDate);
  const [feeling, setFeeling] = useState("");

  const gen = useMutation({
    mutationFn: () => callGen({ data: { feeling } }),
    onSuccess: (r) => setContent(r.content),
  });

  const save = useMutation({
    mutationFn: () => callCreate({ data: { content, deliver_at: new Date(deliverAt).toISOString() } }),
    onSuccess: () => { setContent(""); setFeeling(""); qc.invalidateQueries({ queryKey: ["letters"] }); },
  });

  const now = Date.now();

  return (
    <div className="max-w-4xl mx-auto px-6 pb-20 pt-4">
      <header className="text-center mb-10 animate-fade-up">
        <p className="eyebrow mb-3">Future Letters</p>
        <h1 className="font-serif text-5xl md:text-6xl">Write across time.</h1>
        <p className="mt-4 text-muted-foreground italic font-serif">A sealed envelope to the version of you who hasn't arrived yet.</p>
      </header>

      <div className="glass rounded-[2rem] p-6 md:p-10 mb-12 animate-fade-up">
        <p className="eyebrow mb-3">If words are hard, start here</p>
        <div className="flex gap-3 mb-6">
          <input value={feeling} onChange={(e) => setFeeling(e.target.value)}
                 placeholder="How are you feeling, right now?"
                 className="flex-1 px-4 py-3 rounded-2xl bg-canvas/50 border border-border" />
          <button onClick={() => gen.mutate()} disabled={!feeling.trim() || gen.isPending}
                  className="px-5 py-3 rounded-full border border-border text-xs uppercase tracking-[0.2em] hover:bg-muted disabled:opacity-30">
            {gen.isPending ? "..." : "Help me write"}
          </button>
        </div>

        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10}
                  placeholder="Dear future me,"
                  className="w-full p-5 rounded-2xl bg-canvas/50 border border-border focus:outline-none focus:ring-2 focus:ring-sage text-lg font-serif italic resize-none" />

        <div className="mt-5 flex flex-wrap justify-between items-center gap-3">
          <label className="text-sm flex items-center gap-3">
            <span className="eyebrow">Deliver on</span>
            <input type="date" value={deliverAt} min={new Date().toISOString().slice(0, 10)}
                   onChange={(e) => setDeliverAt(e.target.value)}
                   className="px-3 py-2 rounded-xl glass" />
          </label>
          <button onClick={() => save.mutate()} disabled={!content.trim() || save.isPending}
                  className="px-8 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] disabled:opacity-30">
            {save.isPending ? "Sealing..." : "Seal the envelope"}
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="eyebrow mb-4">In the mailbox</h2>
        {q.data?.map((l) => {
          const ready = new Date(l.deliver_at).getTime() <= now;
          return (
            <article key={l.id} className="glass rounded-3xl p-6 md:p-8 animate-fade-up">
              <div className="flex justify-between items-start mb-3">
                <p className="eyebrow">{ready ? "Delivered" : `Arrives ${new Date(l.deliver_at).toLocaleDateString(undefined, { dateStyle: "long" })}`}</p>
                <span className="text-2xl">{ready ? "✉" : "🕊"}</span>
              </div>
              {ready ? (
                <p className="text-lg font-serif italic leading-relaxed whitespace-pre-wrap">{l.content}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">Sealed. Patience until the day comes.</p>
              )}
            </article>
          );
        })}
        {q.data && q.data.length === 0 && (
          <p className="text-center italic font-serif text-muted-foreground py-8">No letters in flight yet.</p>
        )}
      </section>
    </div>
  );
}
