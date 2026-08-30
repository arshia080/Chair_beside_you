import { useEffect, useRef, useState } from "react";
import { sfx } from "@/components/neon-drift/audio";

// A small Mario-Kart-flavored replica, not a clone: drift for a mini-turbo
// boost, item boxes with a mushroom/banana/shell. No opponents and no way to
// lose — finishing a lap (or not) is just for fun.
type ItemKind = "mushroom" | "banana" | "shell";
type Vec = { x: number; y: number };
// The track is an arbitrary closed curve (not just a rounded rectangle): a
// dense list of centerline points plus their cumulative arc length, so
// on-road / off-road and lap progress both reduce to "distance to nearest
// point on this polyline" — which works identically for an oval, a figure
// eight, or a five-pointed star.
type Track = { points: Vec[]; cumLen: number[]; totalLen: number; halfWidth: number; startAngle: number };
type Kart = { x: number; y: number; angle: number; speed: number; boostTimer: number; boostPower: number; spin: number; driftCharge: number; drifting: boolean; driftDir: 0 | -1 | 1 };
type Box = { x: number; y: number; active: boolean; respawnAt: number };
type Banana = { x: number; y: number; alive: boolean };
type Shell = { x: number; y: number; vx: number; vy: number; life: number } | null;
type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Skid = { x: number; y: number; angle: number; life: number };

type TrackPreset = {
  key: string; label: string;
  // returns a point on the closed curve for t in [0, 2π), in a roughly
  // [-1, 1] normalized space before scaling to the canvas
  shape: (t: number) => Vec;
  rx: number; ry: number; widthRatio: number;
  road: string; grass: string; line: string; dust: string;
};
const TRACKS: TrackPreset[] = [
  {
    key: "oval", label: "Sunny Oval",
    shape: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
    rx: 0.42, ry: 0.36, widthRatio: 0.12,
    road: "#6b6b76", grass: "#4a8a4f", line: "rgba(255,255,255,0.4)", dust: "rgba(120,100,60,0.5)",
  },
  {
    key: "figure8", label: "Figure Eight",
    // lemniscate of Gerono — a real crossing figure-eight, not a rounded rect
    shape: (t) => ({ x: Math.sin(t), y: Math.sin(t) * Math.cos(t) }),
    rx: 0.4, ry: 0.62, widthRatio: 0.1,
    road: "#6a676f", grass: "#3f7d3a", line: "rgba(255,255,255,0.38)", dust: "rgba(120,100,60,0.5)",
  },
  {
    key: "star", label: "Star Circuit",
    // radius modulated at 5x frequency — a scalloped, star-shaped loop
    shape: (t) => { const r = 1 + 0.3 * Math.cos(5 * t); return { x: r * Math.cos(t), y: r * Math.sin(t) }; },
    rx: 0.34, ry: 0.34, widthRatio: 0.08,
    road: "#5a5a63", grass: "#5aa15e", line: "rgba(255,255,255,0.4)", dust: "rgba(120,100,60,0.5)",
  },
  {
    key: "serpentine", label: "Serpentine",
    // two overlapping wave frequencies — an irregular, winding loop
    shape: (t) => { const r = 1 + 0.16 * Math.sin(3 * t) + 0.09 * Math.sin(7 * t + 1); return { x: r * Math.cos(t), y: r * Math.sin(t) }; },
    rx: 0.4, ry: 0.36, widthRatio: 0.09,
    road: "#3a3a4a", grass: "#12121c", line: "rgba(120,220,255,0.45)", dust: "rgba(80,180,255,0.35)",
  },
];

type KartColor = { key: string; label: string; hex: string };
const KART_COLORS: KartColor[] = [
  { key: "red", label: "Red", hex: "#e14b4b" },
  { key: "blue", label: "Blue", hex: "#4b7be1" },
  { key: "green", label: "Green", hex: "#4bd17a" },
  { key: "purple", label: "Purple", hex: "#b14be1" },
  { key: "yellow", label: "Yellow", hex: "#e1c94b" },
];
type KartShape = "classic" | "boxy" | "sporty";
const KART_SHAPES: { key: KartShape; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "boxy", label: "Boxy" },
  { key: "sporty", label: "Sporty" },
];
const PREFS_KEY = "chair.kartloop.prefs";
function loadPrefs(): { track: string; color: string; shape: KartShape } {
  const fallback = { track: TRACKS[0].key, color: KART_COLORS[0].key, shape: "classic" as KartShape };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      track: TRACKS.some((t) => t.key === p.track) ? p.track : fallback.track,
      color: KART_COLORS.some((c) => c.key === p.color) ? p.color : fallback.color,
      shape: KART_SHAPES.some((s) => s.key === p.shape) ? p.shape : fallback.shape,
    };
  } catch { return fallback; }
}
function savePrefs(p: { track: string; color: string; shape: KartShape }) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const STORAGE_KEY = "chair.kartloop.v1";
const MAX_SPEED = 260;
const REVERSE_SPEED = -100;
const TURN_RATE = 2.8;
// Boosts kick speed up instantly (rather than just raising a ceiling you have
// to accelerate into) and hold it for a short sustain window — the actual
// mini-turbo feel, not a barely-noticeable nudge.
const BOOST_1 = { power: 1.35, duration: 0.9 };
const BOOST_2 = { power: 1.6, duration: 1.3 };
const MUSHROOM_BOOST = { power: 1.45, duration: 1.4 };
const SAMPLES = 160;

function approach(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * Math.min(1, rate * dt);
}

function loadLaps(): number {
  try { return Number(localStorage.getItem(STORAGE_KEY) || "0") || 0; } catch { return 0; }
}
function saveLaps(n: number) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch { /* ignore */ }
}

function buildTrack(preset: TrackPreset, w: number, h: number): Track {
  const cx = w / 2, cy = h / 2;
  const rx = w * preset.rx, ry = h * preset.ry;
  const points: Vec[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * Math.PI * 2;
    const p = preset.shape(t);
    points.push({ x: cx + p.x * rx, y: cy + p.y * ry });
  }
  const cumLen: number[] = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    const a = points[i - 1], b = points[i % SAMPLES];
    cumLen.push(cumLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const totalLen = cumLen[SAMPLES];
  const startAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  return { points, cumLen, totalLen, halfWidth: Math.min(w, h) * preset.widthRatio, startAngle };
}

// Nearest point on the closed track polyline: distance (for on/off-road) and
// progress (0..1 fraction of total lap length, for lap counting on ANY shape).
function projectOnTrack(track: Track, px: number, py: number) {
  let best = Infinity, bestFrac = 0;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i], b = track.points[(i + 1) % track.points.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let u = len2 === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2;
    u = Math.max(0, Math.min(1, u));
    const cx = a.x + u * dx, cy = a.y + u * dy;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < best) {
      best = dist;
      bestFrac = (track.cumLen[i] + u * Math.hypot(dx, dy)) / track.totalLen;
    }
  }
  return { dist: best, frac: bestFrac };
}

export function KartLoop() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const keys = useRef<Record<string, boolean>>({});

  const kart = useRef<Kart>({ x: 0, y: 0, angle: 0, speed: 0, boostTimer: 0, boostPower: 1, spin: 0, driftCharge: 0, drifting: false, driftDir: 0 });
  const track = useRef<Track>({ points: [], cumLen: [], totalLen: 1, halfWidth: 40, startAngle: 0 });
  const boxes = useRef<Box[]>([]);
  const bananas = useRef<Banana[]>([]);
  const shell = useRef<Shell>(null);
  const sparks = useRef<Spark[]>([]);
  const skids = useRef<Skid[]>([]);
  const dust = useRef<Spark[]>([]);
  const trail = useRef<{ x: number; y: number; life: number }[]>([]);
  const cumulativeProgress = useRef(0);
  const prevFrac = useRef(0);

  const [heldItem, setHeldItem] = useState<ItemKind | null>(null);
  const heldItemRef = useRef<ItemKind | null>(null);
  const [laps, setLaps] = useState(0);
  const lapsRef = useRef(0);
  const [totalLaps, setTotalLaps] = useState(0);
  const totalLapsRef = useRef(0);
  const [hint, setHint] = useState("Drive with arrow keys. Hold Space while turning to drift for a boost.");

  const [trackKey, setTrackKey] = useState(TRACKS[0].key);
  const [colorKey, setColorKey] = useState(KART_COLORS[0].key);
  const [shapeKey, setShapeKey] = useState<KartShape>("classic");
  // read live inside the render loop without restarting the game effect —
  // changing color/shape shouldn't reset your lap progress
  const colorRef = useRef(KART_COLORS[0].hex);
  const shapeRef = useRef<KartShape>("classic");
  colorRef.current = KART_COLORS.find((c) => c.key === colorKey)?.hex ?? KART_COLORS[0].hex;
  shapeRef.current = shapeKey;

  useEffect(() => {
    const n = loadLaps();
    totalLapsRef.current = n;
    setTotalLaps(n);
    const prefs = loadPrefs();
    setTrackKey(prefs.track);
    setColorKey(prefs.color);
    setShapeKey(prefs.shape);
  }, []);

  const changeTrack = (key: string) => { setTrackKey(key); savePrefs({ track: key, color: colorKey, shape: shapeKey }); };
  const changeColor = (key: string) => { setColorKey(key); savePrefs({ track: trackKey, color: key, shape: shapeKey }); };
  const changeShape = (key: KartShape) => { setShapeKey(key); savePrefs({ track: trackKey, color: colorKey, shape: key }); };

  useEffect(() => {
    const el = wrapRef.current, canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const preset = TRACKS.find((t) => t.key === trackKey) ?? TRACKS[0];

    let initialized = false;
    const layout = (w: number, h: number) => {
      track.current = buildTrack(preset, w, h);
      if (!initialized) {
        initialized = true;
        const p0 = track.current.points[0];
        boxes.current = [0.15, 0.35, 0.6, 0.85].map((f) => {
          const idx = Math.floor(f * SAMPLES) % SAMPLES;
          const p = track.current.points[idx];
          return { x: p.x, y: p.y, active: true, respawnAt: 0 };
        });
        bananas.current = [];
        shell.current = null;
        sparks.current = [];
        skids.current = [];
        dust.current = [];
        trail.current = [];
        kart.current = { x: p0.x, y: p0.y, angle: track.current.startAngle, speed: 0, boostTimer: 0, boostPower: 1, spin: 0, driftCharge: 0, drifting: false, driftDir: 0 };
        prevFrac.current = 0;
        cumulativeProgress.current = 0;
        lapsRef.current = 0;
        setLaps(0);
        heldItemRef.current = null;
        setHeldItem(null);
      }
    };

    const resize = () => {
      const rect = el.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      layout(rect.width, rect.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const applyBoost = (power: number, duration: number) => {
      const k = kart.current;
      k.boostPower = Math.max(k.boostTimer > 0 ? k.boostPower : 1, power);
      k.boostTimer = Math.max(k.boostTimer, duration);
      k.speed = Math.max(k.speed, MAX_SPEED * power * 0.92);
    };

    const useItem = () => {
      const item = heldItemRef.current;
      if (!item) return;
      const k = kart.current;
      if (item === "mushroom") {
        applyBoost(MUSHROOM_BOOST.power, MUSHROOM_BOOST.duration);
        sfx.dash();
        setHint("Zoom!");
      } else if (item === "banana") {
        bananas.current.push({ x: k.x - Math.cos(k.angle) * 22, y: k.y - Math.sin(k.angle) * 22, alive: true });
        sfx.ui();
        setHint("Banana dropped — don't loop back into your own peel.");
      } else if (item === "shell") {
        shell.current = { x: k.x + Math.cos(k.angle) * 24, y: k.y + Math.sin(k.angle) * 24, vx: Math.cos(k.angle) * 380, vy: Math.sin(k.angle) * 380, life: 3 };
        sfx.combo(2);
        setHint("Shell away!");
      }
      heldItemRef.current = null;
      setHeldItem(null);
    };

    const DRIVE_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"]);
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current[key] = true;
      if (DRIVE_KEYS.has(key)) e.preventDefault(); // stop arrow keys/space from scrolling the page
      if (key === "e") useItem();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current[key] = false;
      if (DRIVE_KEYS.has(key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = track.current;
      const k = kart.current;

      const throttle = (keys.current["arrowup"] || keys.current["w"]) ? 1 : (keys.current["arrowdown"] || keys.current["s"]) ? -1 : 0;
      const steer = (keys.current["arrowleft"] || keys.current["a"]) ? -1 : (keys.current["arrowright"] || keys.current["d"]) ? 1 : 0;
      const driftKey = !!keys.current[" "];

      const { dist, frac } = projectOnTrack(t, k.x, k.y);
      const offRoad = dist > t.halfWidth;
      if (k.boostTimer > 0) k.boostTimer = Math.max(0, k.boostTimer - dt);
      const boosting = k.boostTimer > 0;
      const baseMax = offRoad ? MAX_SPEED * 0.55 : MAX_SPEED;
      const maxSpeed = boosting ? baseMax * k.boostPower : baseMax;

      if (k.spin > 0) {
        // spinning out from a banana: no throttle response, just friction — this
        // is the one moment the player isn't in control, so it has to actually bite.
        k.spin -= dt;
        k.speed = approach(k.speed, 0, 2.2, dt);
      } else {
        if (throttle > 0) k.speed = approach(k.speed, maxSpeed, boosting ? 1.2 : 2.6, dt);
        else if (throttle < 0) k.speed = approach(k.speed, REVERSE_SPEED, 2.6, dt);
        else k.speed = approach(k.speed, boosting ? maxSpeed * 0.7 : 0, offRoad ? 1.8 : 0.9, dt);

        // steering always has a little bite (even near-stationary, for tight
        // maneuvering) and ramps up with speed rather than requiring a minimum.
        const turnFactor = 0.3 + 0.7 * Math.min(1, Math.abs(k.speed) / 130);
        if (driftKey && steer !== 0 && Math.abs(k.speed) > 60) {
          if (!k.drifting) { k.drifting = true; k.driftDir = steer as -1 | 1; k.driftCharge = 0; }
          k.angle += steer * TURN_RATE * 1.4 * turnFactor * dt;
          k.driftCharge += dt;
          if (Math.random() < 0.7) skids.current.push({ x: k.x, y: k.y, angle: k.angle, life: 1.4 });
        } else {
          if (k.drifting) {
            if (k.driftCharge > 1.1) { applyBoost(BOOST_2.power, BOOST_2.duration); sfx.power(); setHint("Purple mini-turbo!"); }
            else if (k.driftCharge > 0.5) { applyBoost(BOOST_1.power, BOOST_1.duration); sfx.dash(); setHint("Mini-turbo!"); }
            k.drifting = false; k.driftCharge = 0;
          }
          k.angle += steer * TURN_RATE * turnFactor * dt;
        }
      }

      k.x += Math.cos(k.angle) * k.speed * dt;
      k.y += Math.sin(k.angle) * k.speed * dt;

      // never let the kart drift off the visible canvas and get lost
      const cw = canvas.width / dpr, ch = canvas.height / dpr;
      const clampedX = Math.max(16, Math.min(cw - 16, k.x));
      const clampedY = Math.max(16, Math.min(ch - 16, k.y));
      if (clampedX !== k.x || clampedY !== k.y) k.speed *= 0.5;
      k.x = clampedX; k.y = clampedY;

      // lap tracking via unwrapped progress along the track's own centerline —
      // works for any closed shape, including one that crosses itself
      let delta = frac - prevFrac.current;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      cumulativeProgress.current += delta;
      prevFrac.current = frac;
      const newLaps = Math.floor(Math.abs(cumulativeProgress.current));
      if (newLaps !== lapsRef.current) {
        lapsRef.current = newLaps;
        setLaps(newLaps);
        if (newLaps > 0) {
          totalLapsRef.current += 1;
          setTotalLaps(totalLapsRef.current);
          saveLaps(totalLapsRef.current);
          sfx.collect(2);
          setHint(`Lap ${newLaps} — no rush, no rank, just the drive.`);
        }
      }

      // item boxes
      for (const b of boxes.current) {
        if (!b.active) { if (now >= b.respawnAt) b.active = true; continue; }
        if (Math.hypot(b.x - k.x, b.y - k.y) < 26) {
          b.active = false;
          b.respawnAt = now + 6000;
          const pick: ItemKind[] = ["mushroom", "banana", "shell"];
          const item = pick[Math.floor(Math.random() * pick.length)];
          heldItemRef.current = item;
          setHeldItem(item);
          sfx.collect(1);
        }
      }

      // bananas — including your own, if you loop back over one
      for (const ban of bananas.current) {
        if (!ban.alive) continue;
        if (Math.hypot(ban.x - k.x, ban.y - k.y) < 20) {
          ban.alive = false;
          k.spin = 0.9;
          sfx.hit();
          setHint("Slipped on a banana. Whoops.");
        }
      }
      bananas.current = bananas.current.filter((b) => b.alive);

      // shell flight
      if (shell.current) {
        const s = shell.current;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (s.life <= 0 || projectOnTrack(t, s.x, s.y).dist > t.halfWidth) shell.current = null;
      }

      // ambient effects: boost sparks, off-road dust, drift skid fade, speed trail
      sparks.current = sparks.current.filter((s) => s.life > 0);
      for (const s of sparks.current) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.6; }
      if (boosting && Math.random() < 0.6) {
        sparks.current.push({ x: k.x - Math.cos(k.angle) * 14, y: k.y - Math.sin(k.angle) * 14, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 1, hue: 45 });
      }
      skids.current = skids.current.filter((s) => s.life > 0);
      for (const s of skids.current) s.life -= dt * 0.7;
      dust.current = dust.current.filter((d) => d.life > 0);
      for (const d of dust.current) { d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.2; }
      if (offRoad && Math.abs(k.speed) > 30 && Math.random() < 0.5) {
        dust.current.push({ x: k.x - Math.cos(k.angle) * 10, y: k.y - Math.sin(k.angle) * 10, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20 - 10, life: 0.6, hue: 0 });
      }
      trail.current = trail.current.filter((p) => p.life > 0);
      for (const p of trail.current) p.life -= dt * 2.2;
      if (Math.abs(k.speed) > 140) trail.current.push({ x: k.x, y: k.y, life: 1 });

      // --- render ---
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = preset.grass;
      ctx.fillRect(0, 0, w, h);

      const strokeTrackPath = () => {
        ctx.beginPath();
        t.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
      };

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = preset.road;
      ctx.lineWidth = t.halfWidth * 2;
      strokeTrackPath();
      ctx.stroke();

      ctx.strokeStyle = preset.line;
      ctx.setLineDash([8, 12]);
      ctx.lineWidth = 1.25;
      strokeTrackPath();
      ctx.stroke();
      ctx.setLineDash([]);

      // start/finish checker, perpendicular to the track direction at point 0
      const p0 = t.points[0];
      const dir0 = { x: Math.cos(t.startAngle), y: Math.sin(t.startAngle) };
      const perp = { x: -dir0.y, y: dir0.x };
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#fff" : "#222";
        ctx.fillRect(p0.x + perp.x * i * (t.halfWidth * 2 / 5) - 3, p0.y + perp.y * i * (t.halfWidth * 2 / 5) - 3, 6, 6);
      }

      for (const s of skids.current) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.fillStyle = `rgba(20,20,20,${Math.max(0, s.life) * 0.35})`;
        ctx.fillRect(-6, -2, 12, 4);
        ctx.restore();
      }

      for (const d of dust.current) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = preset.dust.replace(/[\d.]+\)$/, `${Math.max(0, d.life)})`);
        ctx.fill();
      }

      for (const p of trail.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, p.life) * 0.25})`;
        ctx.fill();
      }

      for (const b of boxes.current) {
        if (!b.active) continue;
        const bob = Math.sin(now / 220) * 3;
        ctx.save();
        ctx.translate(b.x, b.y + bob);
        ctx.rotate(now / 500);
        ctx.shadowColor = "rgba(244,196,48,0.8)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#f4c430";
        ctx.fillRect(-10, -10, 20, 20);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#7a4a00";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", 0, 1);
        ctx.restore();
      }

      for (const ban of bananas.current) {
        ctx.fillStyle = "#e8c34a";
        ctx.beginPath();
        ctx.ellipse(ban.x, ban.y, 8, 5, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (shell.current) {
        ctx.save();
        ctx.translate(shell.current.x, shell.current.y);
        ctx.rotate(now / 60);
        ctx.fillStyle = "#4caf50";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2e7d32";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.restore();
      }

      for (const s of sparks.current) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue}, 90%, 65%, ${Math.max(0, s.life)})`;
        ctx.fill();
      }

      // kart — body color and silhouette both follow the player's chosen prefs
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.angle + (k.spin > 0 ? Math.sin(now / 30) * 3 : 0));

      if (k.boostTimer > 0) {
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(-i * 10, 0, 8 - i, 5 - i * 0.8, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 170, 60, ${0.28 / i})`;
          ctx.fill();
        }
      }

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const body = colorRef.current;
      const shape = shapeRef.current;
      ctx.fillStyle = body;
      if (shape === "boxy") {
        ctx.fillRect(-13, -8, 26, 16);
      } else if (shape === "sporty") {
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(6, -9, -13, -7);
        ctx.quadraticCurveTo(-17, 0, -13, 7);
        ctx.quadraticCurveTo(6, 9, 16, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#2c2c2c";
      ctx.fillRect(-4, -9, 8, 4);
      ctx.fillStyle = "#f2c9a0";
      ctx.beginPath();
      ctx.arc(shape === "sporty" ? 6 : 4, -1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  const itemGlyph = { mushroom: "🍄", banana: "🍌", shell: "🐚" } as const;

  return (
    <div className="glass rounded-[2rem] p-6 md:p-8">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow">Kart Loop</p>
        <p className="text-sm text-muted-foreground tabular-nums">Lap {laps} · {totalLaps} lifetime</p>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{hint}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {TRACKS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTrack(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-[0.12em] transition ${
              t.key === trackKey ? "bg-ink text-canvas" : "glass text-muted-foreground hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Color</span>
          {KART_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => changeColor(c.key)}
              aria-label={c.label}
              className={`w-6 h-6 rounded-full transition ${c.key === colorKey ? "ring-2 ring-offset-2 ring-ink" : ""}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Shape</span>
          {KART_SHAPES.map((s) => (
            <button
              key={s.key}
              onClick={() => changeShape(s.key)}
              className={`px-3 py-1 rounded-full text-xs transition ${
                s.key === shapeKey ? "bg-ink text-canvas" : "glass text-muted-foreground hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-2xl overflow-hidden border border-ink/10 select-none touch-none"
        style={{ aspectRatio: "16 / 10" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        <div className="absolute top-3 right-3 w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 grid place-items-center text-2xl">
          {heldItem ? itemGlyph[heldItem] : ""}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Arrow keys / WASD to drive · hold Space while turning to drift for a mini-turbo · E to use an item · no one to race but yourself
      </p>
    </div>
  );
}
