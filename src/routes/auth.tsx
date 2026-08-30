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

  const signInWithGoogle = async () => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/companion` },
    });
    if (error) setErr(error.message);
  };

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

          <button type="button" onClick={signInWithGoogle}
                  className="w-full mb-6 py-4 rounded-full glass text-sm flex items-center justify-center gap-3 hover:opacity-90 transition">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 009 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.95A9 9 0 000 9c0 1.45.35 2.83.95 4.03l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

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
