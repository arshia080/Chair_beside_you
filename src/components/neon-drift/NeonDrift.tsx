import { useEffect, useRef, useState, useCallback } from "react";
import { createInitialState, updateState, render, tryDash, POWER_LABEL, hasActive } from "./engine";
import { sfx, setMuted, isMuted, setVolume, getVolume } from "./audio";
import type { GameState } from "./types";
import { Pause, Play, RotateCcw, Volume2, VolumeX, Trophy, Zap } from "lucide-react";

const BEST_KEY = "neondrift.best";
const MUTE_KEY = "neondrift.muted";
const VOL_KEY = "neondrift.volume";

export function NeonDrift() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const bgPhaseRef = useRef(0);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [actives, setActives] = useState<GameState["actives"]>([]);
  const [status, setStatus] = useState<"idle" | "countdown" | "playing" | "paused" | "over">("idle");
  const [countdown, setCountdown] = useState(3);
  const [muted, setMutedS] = useState(false);
  const [vol, setVol] = useState(0.4);
  const [dashCd, setDashCd] = useState(0);
  const [finalStats, setFinalStats] = useState<{ score: number; time: number; combo: number } | null>(null);
  const bestCombo = useRef(0);

  // load prefs
  useEffect(() => {
    try {
      const b = Number(localStorage.getItem(BEST_KEY) || "0"); if (b) setBest(b);
      const m = localStorage.getItem(MUTE_KEY) === "1"; setMutedS(m); setMuted(m);
      const v = Number(localStorage.getItem(VOL_KEY) || "0.4"); setVol(v); setVolume(v);
    } catch {}
  }, []);

  // resize
  useEffect(() => {
    const el = wrapRef.current, canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      if (stateRef.current) {
        stateRef.current.width = rect.width;
        stateRef.current.height = rect.height;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const loop = (now: number) => {
      const last = lastRef.current || now;
      const dt = Math.min(0.05, (now - last) / 1000);
      lastRef.current = now;
      bgPhaseRef.current += dt * 0.3;
      const s = stateRef.current;
      if (s) {
        if (status === "playing") updateState(s, dt);
        else updateState(s, 0); // still animate particles subtly
        render(ctx, s, dpr, bgPhaseRef.current);
        if (s.combo > bestCombo.current) bestCombo.current = s.combo;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status]);

  // UI sync at ~10hz
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current; if (!s) return;
      setScore(Math.floor(s.score));
      setCombo(s.combo);
      setActives([...s.actives]);
      setDashCd(s.player.dashCooldown);
      if (s.gameOver && status === "playing") {
        setStatus("over");
        const final = Math.floor(s.score);
        setFinalStats({ score: final, time: s.time, combo: bestCombo.current });
        if (final > best) {
          setBest(final);
          try { localStorage.setItem(BEST_KEY, String(final)); } catch {}
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [status, best]);

  // pointer / touch
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const move = (cx: number, cy: number) => {
      const s = stateRef.current; if (!s) return;
      const rect = canvas.getBoundingClientRect();
      s.player.tx = cx - rect.left;
      s.player.ty = cy - rect.top;
    };
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      move(e.clientX, e.clientY);
      if (status === "playing" && stateRef.current) tryDash(stateRef.current);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [status]);

  // visibility pause
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && status === "playing") setStatus("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "playing" && stateRef.current) tryDash(stateRef.current);
        else if (status === "idle" || status === "over") startGame();
      } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (status === "playing") setStatus("paused");
        else if (status === "paused") setStatus("playing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const startGame = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    stateRef.current = createInitialState(rect.width, rect.height);
    stateRef.current.running = false;
    bestCombo.current = 0;
    setFinalStats(null);
    setStatus("countdown");
    setCountdown(3);
    let n = 3;
    sfx.ui();
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        setStatus("playing");
        if (stateRef.current) stateRef.current.running = true;
        return;
      }
      setCountdown(n);
      sfx.ui();
      setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  }, []);

  const toggleMute = () => {
    const m = !muted; setMutedS(m); setMuted(m);
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {}
  };
  const onVolChange = (v: number) => {
    setVol(v); setVolume(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch {}
  };

  return (
    <div className="glass rounded-[2rem] p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow">Neon Drift</p>
          <p className="text-sm text-muted-foreground mt-1">Guide the orb. Collect light. Breathe through the drift.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-full grid place-items-center glass hover:bg-ink/5 transition"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05} value={vol}
            onChange={(e) => onVolChange(Number(e.target.value))}
            className="w-20 accent-ink hidden sm:block"
            aria-label="Volume"
          />
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-2xl overflow-hidden border border-ink/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)] select-none touch-none"
        style={{ aspectRatio: "16 / 10", background: "#0b0d18" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-none" />

        {/* HUD */}
        {(status === "playing" || status === "paused") && (
          <>
            <div className="absolute top-3 left-4 pointer-events-none">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Score</p>
              <p className="font-serif italic text-3xl text-white tabular-nums drop-shadow">{score.toLocaleString()}</p>
              {combo >= 3 && (
                <p className="text-xs text-amber-200/90 mt-1 animate-fade-up">Combo x{Math.floor(combo / 3) + 1}</p>
              )}
            </div>
            <div className="absolute top-3 right-4 text-right pointer-events-none">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 flex items-center gap-1 justify-end">
                <Trophy className="w-3 h-3" /> Best
              </p>
              <p className="font-serif italic text-2xl text-white/80 tabular-nums">{best.toLocaleString()}</p>
            </div>

            {/* dash indicator */}
            <div className="absolute bottom-3 left-4 pointer-events-none flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-cyan-300 transition-[width] duration-100"
                  style={{ width: `${Math.max(0, Math.min(1, 1 - dashCd / 2.2)) * 100}%` }}
                />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Dash
              </span>
            </div>

            {/* active powerups */}
            <div className="absolute bottom-3 right-4 flex flex-wrap gap-2 justify-end max-w-[60%]">
              {actives.map((a) => (
                <div key={a.kind} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] text-white/90 flex items-center gap-1.5">
                  <span>{POWER_LABEL[a.kind]}</span>
                  <span className="text-white/50 tabular-nums">{a.time.toFixed(1)}s</span>
                </div>
              ))}
            </div>

            {/* corner controls */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              <button
                onClick={() => setStatus(status === "paused" ? "playing" : "paused")}
                className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/15 grid place-items-center text-white hover:bg-white/20 transition"
                aria-label={status === "paused" ? "Resume" : "Pause"}
              >
                {status === "paused" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={startGame}
                className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/15 grid place-items-center text-white hover:bg-white/20 transition"
                aria-label="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {/* Idle overlay */}
        {status === "idle" && (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-black/40 via-black/20 to-black/60 backdrop-blur-[2px] animate-fade-up">
            <div className="text-center max-w-sm px-6">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">Neon Drift</p>
              <h3 className="font-serif italic text-4xl text-white mb-3">A soft arcade.</h3>
              <p className="text-sm text-white/70 mb-6 leading-relaxed">
                Move with your cursor. Collect light. Dodge the drifting shapes. Click or tap to dash.
              </p>
              <button
                onClick={startGame}
                className="px-7 py-3 rounded-full bg-white text-slate-900 text-sm font-medium hover:bg-white/90 transition shadow-lg"
              >
                Begin gently
              </button>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-4">Space to start · P to pause</p>
            </div>
          </div>
        )}

        {/* Countdown */}
        {status === "countdown" && (
          <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-sm">
            <div key={countdown} className="font-serif italic text-white text-8xl animate-fade-up">{countdown}</div>
          </div>
        )}

        {/* Paused */}
        {status === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-md animate-fade-up">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2">Paused</p>
              <h3 className="font-serif italic text-4xl text-white mb-5">Take a breath.</h3>
              <button
                onClick={() => setStatus("playing")}
                className="px-6 py-2.5 rounded-full bg-white text-slate-900 text-sm font-medium hover:bg-white/90 transition"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Game over */}
        {status === "over" && finalStats && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-md animate-fade-up">
            <div className="text-center max-w-sm px-6">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2">Drift ended</p>
              <h3 className="font-serif italic text-4xl text-white mb-6">Well drifted.</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Stat label="Score" value={finalStats.score.toLocaleString()} />
                <Stat label="Time" value={`${finalStats.time.toFixed(1)}s`} />
                <Stat label="Best combo" value={`x${Math.max(1, Math.floor(finalStats.combo / 3) + 1)}`} />
              </div>
              {finalStats.score >= best && finalStats.score > 0 && (
                <p className="text-amber-200 text-sm mb-4 flex items-center justify-center gap-1.5">
                  <Trophy className="w-4 h-4" /> New best
                </p>
              )}
              <button
                onClick={startGame}
                className="px-7 py-3 rounded-full bg-white text-slate-900 text-sm font-medium hover:bg-white/90 transition shadow-lg"
              >
                Drift again
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Move with your cursor · Click or tap to dash · Collect light, dodge shapes
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="font-serif italic text-xl text-white tabular-nums mt-1">{value}</p>
    </div>
  );
}
