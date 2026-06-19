import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import chairImg from "@/assets/chair.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Pull up a chair — The Chair Beside You" },
      { name: "description", content: "Create a quiet account to begin." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/companion`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/companion" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went quiet. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-canvas grid md:grid-cols-2">
      <div className="hidden md:block relative overflow-hidden">
        <img src={chairImg} alt="" className="w-full h-full object-cover animate-breathe" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/60 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="eyebrow mb-3">A safe corner</p>
          <p className="font-serif italic text-2xl text-ink">"You don't have to explain yourself here."</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 md:p-16">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-up">
          <p className="eyebrow mb-4">{mode === "signup" ? "Pull up a chair" : "Welcome back"}</p>
          <h1 className="font-serif text-4xl mb-8">
            {mode === "signup" ? "Begin quietly." : "Sit down again."}
          </h1>

          {mode === "signup" && (
            <label className="block mb-4">
              <span className="eyebrow mb-2 block">What may we call you</span>
              <input type="text" value={displayName} onChange={e => setName(e.target.value)}
                     className="w-full px-5 py-4 rounded-2xl glass focus:outline-none focus:ring-2 focus:ring-sage" />
            </label>
          )}

          <label className="block mb-4">
            <span className="eyebrow mb-2 block">Email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   className="w-full px-5 py-4 rounded-2xl glass focus:outline-none focus:ring-2 focus:ring-sage" />
          </label>

          <label className="block mb-6">
            <span className="eyebrow mb-2 block">Password</span>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                   className="w-full px-5 py-4 rounded-2xl glass focus:outline-none focus:ring-2 focus:ring-sage" />
          </label>

          {err && <p className="text-sm text-destructive mb-4">{err}</p>}

          <button type="submit" disabled={busy}
                  className="w-full py-4 bg-ink text-canvas rounded-full text-xs uppercase tracking-[0.25em] hover:opacity-90 disabled:opacity-50 transition">
            {busy ? "A moment..." : mode === "signup" ? "Create my space" : "Come in"}
          </button>

          <button type="button" onClick={() => setMode(m => m === "signup" ? "signin" : "signup")}
                  className="w-full mt-6 text-sm text-muted-foreground hover:text-ink transition">
            {mode === "signup" ? "I've been here before →" : "I'm new, create my space →"}
          </button>
        </form>
      </div>
    </div>
  );
}
