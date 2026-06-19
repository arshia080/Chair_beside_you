import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addEntry, deleteEntry, listEntries } from "@/lib/journal.functions";

type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRInstance = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: (e: SREvent) => void; onerror: () => void; onend: () => void;
  start: () => void;
};

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

const moods = ["heavy", "tender", "tired", "anxious", "small", "okay", "hopeful"] as const;

function JournalPage() {
  const qc = useQueryClient();
  const callList = useServerFn(listEntries);
  const callAdd = useServerFn(addEntry);
  const callDelete = useServerFn(deleteEntry);

  const entriesQ = useQuery({ queryKey: ["journal"], queryFn: () => callList() });

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("");
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const add = useMutation({
    mutationFn: () => callAdd({ data: { content, mood: mood || undefined } }),
    onSuccess: () => { setContent(""); setMood(""); qc.invalidateQueries({ queryKey: ["journal"] }); },
  });

  const voiceJournal = () => {
    setVoiceErr(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => SRInstance;
      webkitSpeechRecognition?: new () => SRInstance;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setVoiceErr("Your browser doesn't support voice journaling yet."); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    setListening(true);
    rec.onresult = (e: SREvent) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
      }
      if (final) setContent((c) => (c + " " + final).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pb-20 pt-4">
      <header className="text-center mb-10 animate-fade-up">
        <p className="eyebrow mb-3">Tears Journal</p>
        <h1 className="font-serif text-5xl md:text-6xl">What needs to leave you?</h1>
        <p className="mt-4 text-muted-foreground italic font-serif">No one will read this but you, and the quiet companion.</p>
      </header>

      <div className="glass rounded-[2rem] p-6 md:p-10 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="flex flex-wrap gap-2 mb-5">
          {moods.map((m) => (
            <button key={m} onClick={() => setMood(m === mood ? "" : m)}
                    className={`px-4 py-1.5 rounded-full text-xs transition ${
                      mood === m ? "bg-ink text-canvas" : "border border-border hover:bg-muted"
                    }`}>{m}</button>
          ))}
        </div>

        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          rows={8} placeholder="Let it spill. Sentences don't have to make sense."
          className="w-full resize-none p-5 rounded-2xl bg-canvas/50 border border-border focus:outline-none focus:ring-2 focus:ring-sage text-lg font-serif italic placeholder:text-muted-foreground/60"
        />

        {voiceErr && <p className="text-xs text-destructive mt-3">{voiceErr}</p>}

        <div className="flex justify-between items-center mt-5 gap-3">
          <button onClick={voiceJournal} disabled={listening}
                  className="px-5 py-3 rounded-full border border-border text-xs uppercase tracking-[0.2em] hover:bg-muted disabled:opacity-50">
            {listening ? "● listening..." : "Speak instead"}
          </button>
          <button
            onClick={() => add.mutate()} disabled={!content.trim() || add.isPending}
            className="px-8 py-3 rounded-full bg-ink text-canvas text-xs uppercase tracking-[0.25em] hover:opacity-90 disabled:opacity-30">
            {add.isPending ? "Receiving..." : "Release"}
          </button>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="eyebrow mb-6">Mood timeline</h2>
        <div className="flex gap-1.5 items-end h-16 overflow-x-auto pb-2 mb-12">
          {entriesQ.data?.slice(0, 60).reverse().map((e) => (
            <div key={e.id} className="size-3 rounded-full shrink-0"
                 title={`${e.mood ?? "—"} · ${new Date(e.created_at).toLocaleDateString()}`}
                 style={{ backgroundColor: moodColor(e.mood) }} />
          ))}
        </div>

        <div className="space-y-6">
          {entriesQ.data?.map((e) => (
            <article key={e.id} className="glass rounded-3xl p-6 md:p-8 animate-fade-up">
              <div className="flex justify-between items-start mb-4 text-xs">
                <p className="eyebrow">{new Date(e.created_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</p>
                <div className="flex gap-3 items-center">
                  {e.mood && <span className="px-2 py-0.5 rounded-full bg-sage/15 text-xs">{e.mood}</span>}
                  <button onClick={async () => {
                    if (!confirm("Release this entry?")) return;
                    await callDelete({ data: { id: e.id } });
                    qc.invalidateQueries({ queryKey: ["journal"] });
                  }} className="text-muted-foreground hover:text-destructive">×</button>
                </div>
              </div>
              <p className="text-lg font-serif italic leading-relaxed whitespace-pre-wrap">{e.content}</p>
              {e.ai_reflection && (
                <div className="mt-5 pt-5 border-t border-border">
                  <p className="eyebrow mb-2">A gentle reflection</p>
                  <p className="text-sm text-ink/70 leading-relaxed">{e.ai_reflection}</p>
                </div>
              )}
            </article>
          ))}
          {entriesQ.data && entriesQ.data.length === 0 && (
            <p className="text-center text-muted-foreground italic font-serif py-12">The page is blank. That's a beginning too.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function moodColor(m: string | null) {
  switch (m) {
    case "heavy": return "#4A4544";
    case "tender": return "#E8D5C8";
    case "tired": return "#A8A29E";
    case "anxious": return "#C4654A";
    case "small": return "#919A8C";
    case "okay": return "#D8D2C2";
    case "hopeful": return "#F4E4C9";
    default: return "rgba(44,44,44,0.15)";
  }
}
