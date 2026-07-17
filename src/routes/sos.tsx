import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { NeonDrift } from "@/components/neon-drift/NeonDrift";

export const Route = createFileRoute("/sos")({
  head: () => ({
    meta: [
      { title: "A hand to hold — SOS" },
      { name: "description", content: "Grounding, breathing, gentle words, and a small soothing game for the hardest moments." },
    ],
  }),
  component: SOSPage,
});

const QUOTES = [
  { text: "This too shall pass. Not by rushing, but by breathing.", author: "A gentle reminder" },
  { text: "You are not behind. You are not broken. You are becoming.", author: "The Chair Beside You" },
  { text: "Courage is not the absence of fear. It is the decision that something else matters more.", author: "Ambrose Redmoon" },
  { text: "Be gentle with yourself. You are doing the best you can with what you have today.", author: "A soft voice" },
  { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
  { text: "You have survived every single hard day so far. That is no small thing.", author: "The Chair Beside You" },
  { text: "Strength does not always roar. Sometimes it is the quiet voice at the end of the day saying, 'I will try again tomorrow.'", author: "Mary Anne Radmacher" },
  { text: "You are allowed to rest. You are allowed to begin again. You are allowed to be human.", author: "A gentle reminder" },
  { text: "Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure.", author: "Oprah Winfrey" },
  { text: "No feeling is final. Every storm runs out of rain.", author: "Maya Angelou" },
];

function SOSPage() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "rest">("in");
  const [count, setCount] = useState(4);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const seq: Array<{ p: typeof phase; t: number }> = [
      { p: "in", t: 4 }, { p: "hold", t: 7 }, { p: "out", t: 8 }, { p: "rest", t: 2 },
    ];
    let idx = 0;
    setPhase(seq[0].p); setCount(seq[0].t);
    const id = setInterval(() => {
      setCount((c) => {
        if (c > 1) return c - 1;
        idx = (idx + 1) % seq.length;
        setPhase(seq[idx].p);
        return seq[idx].t;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const label = { in: "Breathe in", hold: "Hold", out: "Breathe out", rest: "Rest" }[phase];
  const quote = QUOTES[quoteIndex];

  return (
    <div className="min-h-screen bg-canvas">
      <AppNav />
      <main className="pt-32 px-6 pb-20 max-w-4xl mx-auto">
        <div className="text-center mb-12 animate-fade-up">
          <p className="eyebrow mb-4 text-destructive">A hand to hold</p>
          <h1 className="font-serif text-5xl md:text-6xl">You are safe in this moment.</h1>
          <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
            Stay here as long as you need. Nothing is required of you.
          </p>
        </div>

        <div className="glass rounded-[2rem] p-12 md:p-16 mb-8 text-center animate-fade-up" style={{ animationDelay: "100ms" }}>
          <p className="eyebrow mb-8">4 · 7 · 8 Breathing</p>
          <div className="relative w-64 h-64 mx-auto mb-8">
            <div className={`absolute inset-0 rounded-full bg-sage/30 transition-all duration-1000 ${
              phase === "in" ? "scale-100" : phase === "hold" ? "scale-100" : phase === "out" ? "scale-50" : "scale-50"
            }`} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-serif text-4xl italic mb-2">{label}</p>
              <p className="text-6xl font-serif tabular-nums">{count}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Follow the circle. In through your nose, out through your mouth.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="glass rounded-3xl p-8">
            <p className="eyebrow mb-4">5 · 4 · 3 · 2 · 1 Grounding</p>
            <ul className="space-y-3 text-sm">
              <li><b className="font-serif italic">5</b> things you can see</li>
              <li><b className="font-serif italic">4</b> things you can touch</li>
              <li><b className="font-serif italic">3</b> things you can hear</li>
              <li><b className="font-serif italic">2</b> things you can smell</li>
              <li><b className="font-serif italic">1</b> thing you can taste</li>
            </ul>
          </div>

          <div className="bg-ink text-canvas rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <p className="eyebrow mb-4 text-canvas/60">A gentle word</p>
              <blockquote className="font-serif text-2xl md:text-3xl italic leading-relaxed transition-opacity duration-700">
                “{quote.text}”
              </blockquote>
              <p className="mt-4 text-sm text-canvas/60">— {quote.author}</p>
            </div>
            <div className="flex gap-2 mt-6">
              {QUOTES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setQuoteIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === quoteIndex ? "w-6 bg-canvas/60" : "w-1.5 bg-canvas/20 hover:bg-canvas/30"
                  }`}
                  aria-label={`Show quote ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <NeonDrift />
        </div>

        <div className="text-center mt-12">
          <Link to="/companion" className="text-sm italic font-serif text-muted-foreground hover:text-ink transition">
            ← When you're ready, the companion is here.
          </Link>
        </div>
      </main>
    </div>
  );
}

