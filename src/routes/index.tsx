import { createFileRoute, Link } from "@tanstack/react-router";
import chairImg from "@/assets/chair.jpg";
import { AppNav } from "@/components/AppNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Chair Beside You — For heavy days" },
      { name: "description", content: "A quiet, AI-powered companion for loneliness, self-doubt, interview anxiety, and the days nobody sits beside you." },
      { property: "og:title", content: "The Chair Beside You" },
      { property: "og:description", content: "For the days when nobody sits beside you." },
    ],
  }),
  component: Index,
});

const surfaces = [
  { n: "01", title: "Tears Journal", body: "Release what you carry. The words that only flow when you're overwhelmed have a home here.", to: "/journal" },
  { n: "02", title: "Confidence Garden", body: "Plant small brave actions. Watch quiet resilience bloom over weeks, not days.", to: "/garden" },
  { n: "03", title: "AI Companion", body: "Not a coach. A witness. Someone to sit in the silence until the air feels lighter.", to: "/companion", dark: true },
  { n: "04", title: "Future Letters", body: "Speak to the version of you who hasn't arrived yet. We'll deliver it on the day you need it.", to: "/letters" },
  { n: "05", title: "Victory Vault", body: "The certificate, the kind text, the small win. Saved for the days you forget how far you've come.", to: "/vault" },
  { n: "06", title: "Confidence Coach", body: "Interviews, presentations, vivas, meetings. Personalized rituals for the moments that matter.", to: "/coach" },
] as const;

function Index() {
  return (
    <div className="min-h-screen bg-canvas text-ink overflow-x-hidden">
      <AppNav />

      <main className="relative pt-36 pb-24 px-6 flex flex-col items-center">
        <div className="absolute inset-x-0 top-32 h-[500px] pointer-events-none animate-drift opacity-60"
             style={{ background: "var(--gradient-aura)" }} />

        <div className="max-w-3xl text-center relative z-10 animate-fade-up">
          <p className="eyebrow mb-6">A quiet space, est. for the lonely hours</p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tight">
            For the days when<br />
            <span className="italic">nobody sits beside you.</span>
          </h1>
        </div>

        <div className="relative w-full max-w-md mx-auto my-16 flex justify-center items-center animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="absolute chair-shadow w-[420px] h-[420px] -bottom-12" />
          <div className="animate-breathe relative rounded-3xl overflow-hidden glass shadow-[var(--shadow-soft)]">
            <img src={chairImg} alt="An empty wooden chair in a softly sunlit room" width={800} height={1000}
                 className="w-64 md:w-80 aspect-[4/5] object-cover" />
          </div>
        </div>

        <div className="text-center animate-fade-up" style={{ animationDelay: "300ms" }}>
          <Link to="/companion"
                className="group relative inline-flex px-12 py-5 bg-ink text-canvas rounded-full text-xs uppercase tracking-[0.25em] overflow-hidden transition-all hover:scale-[1.02] active:scale-95 shadow-[var(--shadow-soft)]">
            <span className="relative z-10">Sit beside me</span>
            <div className="absolute inset-0 bg-sage opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
          <p className="mt-6 text-muted-foreground text-sm italic font-serif">A quiet space for your heaviest thoughts.</p>
        </div>

        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl w-full mt-40">
          {surfaces.map((s, i) => (
            // @ts-expect-error typed router
            <Link key={s.n} to={s.to}
                  className={`group p-8 rounded-3xl transition-all duration-500 hover:-translate-y-1 animate-fade-up ${
                    s.dark ? "bg-ink text-canvas shadow-[var(--shadow-soft)]" : "glass hover:bg-card"
                  }`}
                  style={{ animationDelay: `${400 + i * 80}ms` }}>
              <div className={`size-9 mb-6 border rounded-full flex items-center justify-center text-[10px] tracking-widest ${
                s.dark ? "border-canvas/20 text-canvas/60" : "border-border text-muted-foreground"
              }`}>{s.n}</div>
              <h3 className="font-serif text-2xl mb-3">{s.title}</h3>
              <p className={`text-sm leading-relaxed mb-6 ${s.dark ? "text-canvas/65" : "text-muted-foreground"}`}>{s.body}</p>
              <div className={`h-px w-full ${s.dark ? "bg-canvas/15" : "bg-border"} group-hover:bg-sage/40 transition-colors`} />
              <p className={`mt-4 text-[10px] uppercase tracking-[0.2em] ${s.dark ? "text-canvas/50" : "text-muted-foreground"} group-hover:text-sage transition-colors`}>
                Enter →
              </p>
            </Link>
          ))}
        </section>

        <section className="max-w-3xl text-center mt-40 animate-fade-up">
          <p className="eyebrow mb-6">What makes this different</p>
          <p className="font-serif text-3xl md:text-4xl italic leading-[1.3] text-ink/90">
            The companion remembers your emotional journey — and gently reminds you of moments when you were stronger than you believed.
          </p>
        </section>
      </main>

      <footer className="py-20 text-center border-t border-border mt-20">
        <div className="flex justify-center gap-3 mb-8">
          <div className="size-1.5 rounded-full bg-ink/20" />
          <div className="size-1.5 rounded-full bg-ink/20" />
          <div className="size-1.5 rounded-full bg-ink/20" />
        </div>
        <p className="eyebrow">Rest. You've earned it.</p>
      </footer>
    </div>
  );
}
