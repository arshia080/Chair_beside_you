import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const links = [
  { to: "/companion", label: "Companion" },
  { to: "/coach", label: "Coach" },
  { to: "/journal", label: "Journal" },
  { to: "/garden", label: "Garden" },
  { to: "/letters", label: "Letters" },
  { to: "/vault", label: "Vault" },
] as const;

export function AppNav() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-5 flex justify-between items-center backdrop-blur-md bg-canvas/60 border-b border-border">
      <Link to="/" className="font-serif italic text-base md:text-lg font-semibold tracking-tight">
        The Chair Beside You
      </Link>
      <div className="hidden lg:flex items-center gap-7 text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-ink transition-colors" activeProps={{ className: "text-ink" }}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Link to="/sos" className="px-4 py-2 border border-border rounded-full text-[10px] uppercase tracking-[0.2em] glass hover:bg-blush/40 transition-all">
          SOS
        </Link>
        {authed ? (
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="hidden md:inline-flex px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-ink"
          >
            Leave
          </button>
        ) : (
          <Link to="/auth" className="hidden md:inline-flex px-5 py-2 rounded-full bg-ink text-canvas text-[10px] uppercase tracking-[0.2em] hover:opacity-90">
            Sit beside me
          </Link>
        )}
      </div>
    </nav>
  );
}
