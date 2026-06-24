import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

export const Route = createFileRoute("/sos")({
  head: () => ({
    meta: [
      { title: "A hand to hold — SOS" },
      { name: "description", content: "Grounding, breathing, and crisis resources for the hardest moments." },
    ],
  }),
  component: SOSPage,
});

function SOSPage() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "rest">("in");
  const [count, setCount] = useState(4);

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

  const label = { in: "Breathe in", hold: "Hold", out: "Breathe out", rest: "Rest" }[phase];

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
          <LocalCrisisResources />
        </div>

        <div className="text-center mt-12">
          <Link to="/companion" className="text-sm italic font-serif text-muted-foreground hover:text-ink transition">
            ← When you're ready, the companion is here.
          </Link>
        </div>
      </main>

        <div className="text-center mt-12">
          <Link to="/companion" className="text-sm italic font-serif text-muted-foreground hover:text-ink transition">
            ← When you're ready, the companion is here.
          </Link>
        </div>
      </main>
    </div>
  );
}

type Hotline = { number: string; label: string };
type Region = { country: string; hotlines: Hotline[]; emergency: string };

const HOTLINES: Record<string, Region> = {
  US: { country: "United States", emergency: "911", hotlines: [
    { number: "988", label: "Suicide & Crisis Lifeline (call or text)" },
    { number: "Text HOME to 741741", label: "Crisis Text Line" },
    { number: "1-800-799-7233", label: "Domestic Violence Hotline" },
  ]},
  GB: { country: "United Kingdom", emergency: "999", hotlines: [
    { number: "116 123", label: "Samaritans (24/7, free)" },
    { number: "Text SHOUT to 85258", label: "Shout Crisis Text Line" },
    { number: "0800 58 58 58", label: "CALM (5pm–midnight)" },
  ]},
  IE: { country: "Ireland", emergency: "112", hotlines: [
    { number: "116 123", label: "Samaritans Ireland" },
    { number: "Text HELLO to 50808", label: "Text About It" },
  ]},
  CA: { country: "Canada", emergency: "911", hotlines: [
    { number: "988", label: "Suicide Crisis Helpline (call or text)" },
    { number: "1-833-456-4566", label: "Talk Suicide Canada" },
  ]},
  AU: { country: "Australia", emergency: "000", hotlines: [
    { number: "13 11 14", label: "Lifeline Australia" },
    { number: "1300 659 467", label: "Suicide Call Back Service" },
    { number: "Text 0477 13 11 14", label: "Lifeline Text" },
  ]},
  NZ: { country: "New Zealand", emergency: "111", hotlines: [
    { number: "1737", label: "Need to Talk? (call or text)" },
    { number: "0800 543 354", label: "Lifeline Aotearoa" },
  ]},
  IN: { country: "India", emergency: "112", hotlines: [
    { number: "9152987821", label: "iCall (Mon–Sat, 8am–10pm)" },
    { number: "1800-599-0019", label: "KIRAN Mental Health Helpline" },
  ]},
  DE: { country: "Germany", emergency: "112", hotlines: [
    { number: "0800 111 0 111", label: "Telefonseelsorge (24/7, free)" },
  ]},
  FR: { country: "France", emergency: "112", hotlines: [
    { number: "3114", label: "Numéro national de prévention du suicide" },
    { number: "01 45 39 40 00", label: "SOS Amitié" },
  ]},
  ES: { country: "Spain", emergency: "112", hotlines: [
    { number: "024", label: "Línea de atención a la conducta suicida" },
  ]},
  IT: { country: "Italy", emergency: "112", hotlines: [
    { number: "800 86 00 22", label: "Telefono Amico" },
  ]},
  NL: { country: "Netherlands", emergency: "112", hotlines: [
    { number: "113", label: "113 Zelfmoordpreventie" },
  ]},
  BR: { country: "Brazil", emergency: "192", hotlines: [
    { number: "188", label: "CVV — Centro de Valorização da Vida" },
  ]},
  MX: { country: "Mexico", emergency: "911", hotlines: [
    { number: "800 290 0024", label: "SAPTEL (24/7)" },
  ]},
  JP: { country: "Japan", emergency: "110", hotlines: [
    { number: "0570-064-556", label: "Yorisoi Hotline" },
  ]},
  ZA: { country: "South Africa", emergency: "10111", hotlines: [
    { number: "0800 567 567", label: "SADAG Suicide Crisis Line" },
  ]},
};

const DEFAULT_REGION: Region = {
  country: "Worldwide",
  emergency: "your local emergency number",
  hotlines: [
    { number: "findahelpline.com", label: "Find a helpline in your country" },
    { number: "befrienders.org", label: "Befrienders Worldwide directory" },
  ],
};

function LocalCrisisResources() {
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const code = (data?.country_code || data?.country || "").toUpperCase();
        if (cancelled) return;
        setRegion(HOTLINES[code] || DEFAULT_REGION);
      } catch {
        if (!cancelled) setRegion(DEFAULT_REGION);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-ink text-canvas rounded-3xl p-8">
      <p className="eyebrow mb-4 text-canvas/60">
        {loading ? "Finding support near you…" : `Support in ${region?.country ?? "your area"}`}
      </p>
      <ul className="space-y-3 text-sm">
        {(region?.hotlines ?? []).map((h) => (
          <li key={h.number}>
            <b className="font-serif text-lg italic">{h.number}</b> — {h.label}
          </li>
        ))}
        <li className="text-canvas/60 text-xs pt-2">
          If you are in immediate danger, please call {region?.emergency ?? "your local emergency number"}.
        </li>
      </ul>
    </div>
  );
}
  );
}
