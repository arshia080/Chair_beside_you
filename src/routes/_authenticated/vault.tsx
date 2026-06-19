import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addVictory, deleteVictory, listVictories } from "@/lib/vault.functions";

export const Route = createFileRoute("/_authenticated/vault")({
  component: VaultPage,
});

function VaultPage() {
  const qc = useQueryClient();
  const callList = useServerFn(listVictories);
  const callAdd = useServerFn(addVictory);
  const callDel = useServerFn(deleteVictory);

  const q = useQuery({ queryKey: ["vault"], queryFn: () => callList() });

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [img, setImg] = useState("");

  const add = useMutation({
    mutationFn: () => callAdd({ data: { title, note: note || undefined, image_url: img || undefined } }),
    onSuccess: () => { setTitle(""); setNote(""); setImg(""); qc.invalidateQueries({ queryKey: ["vault"] }); },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20 pt-4">
      <header className="text-center mb-10 animate-fade-up">
        <p className="eyebrow mb-3">Victory Vault</p>
        <h1 className="font-serif text-5xl md:text-6xl">Proof you've done hard things.</h1>
        <p className="mt-4 text-muted-foreground italic font-serif">For the days you forget how far you've come.</p>
      </header>

      <div className="glass rounded-3xl p-6 md:p-8 mb-10 animate-fade-up">
        <p className="eyebrow mb-4">Add a victory</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you accomplish?"
               className="w-full px-4 py-3 rounded-2xl glass mb-3" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A little context (optional)"
                  rows={2} className="w-full px-4 py-3 rounded-2xl glass mb-3 resize-none" />
        <input value={img} onChange={(e) => setImg(e.target.value)} placeholder="Image URL (certificate, photo) — optional"
               className="w-full px-4 py-3 rounded-2xl glass mb-4" />
        <div className="flex justify-end">
          <button onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}
                  className="px-8 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] disabled:opacity-30">
            {add.isPending ? "..." : "Save to vault"}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {q.data?.map((v) => (
          <article key={v.id} className="glass rounded-3xl overflow-hidden group animate-fade-up">
            {v.image_url && (
              <div className="aspect-video overflow-hidden bg-muted">
                <img src={v.image_url} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
            )}
            <div className="p-6">
              <p className="eyebrow mb-2">{new Date(v.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
              <h3 className="font-serif text-xl mb-2">{v.title}</h3>
              {v.note && <p className="text-sm text-muted-foreground leading-relaxed">{v.note}</p>}
              <button onClick={async () => {
                if (!confirm("Remove this victory?")) return;
                await callDel({ data: { id: v.id } });
                qc.invalidateQueries({ queryKey: ["vault"] });
              }} className="mt-4 text-xs text-muted-foreground hover:text-destructive">remove</button>
            </div>
          </article>
        ))}
        {q.data && q.data.length === 0 && (
          <p className="col-span-full text-center italic font-serif text-muted-foreground py-12">
            Start with one. Even getting out of bed today counts.
          </p>
        )}
      </div>
    </div>
  );
}
