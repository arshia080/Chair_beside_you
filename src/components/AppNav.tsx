import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-canvas/60 border-b border-border">
      <div className="px-6 md:px-10 py-5 flex justify-between items-center">
        <Link to="/" onClick={() => setMenuOpen(false)} className="font-serif italic text-base md:text-lg font-semibold tracking-tight">
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
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden w-9 h-9 grid place-items-center rounded-full glass"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-border bg-canvas/95 backdrop-blur-md px-6 py-5 flex flex-col gap-1 animate-fade-up">
          {links.map((l) => (
            <Link
              key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
              className="py-3 text-sm uppercase tracking-[0.15em] text-muted-foreground hover:text-ink transition-colors"
              activeProps={{ className: "text-ink" }}
            >
              {l.label}
            </Link>
          ))}
          <div className="h-px bg-border my-3" />
          {authed ? (
            <button
              onClick={async () => { setMenuOpen(false); await supabase.auth.signOut(); navigate({ to: "/" }); }}
              className="py-3 text-left text-sm uppercase tracking-[0.15em] text-muted-foreground hover:text-ink"
            >
              Leave
            </button>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="py-3 text-sm uppercase tracking-[0.15em] text-ink font-medium">
              Sit beside me
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
