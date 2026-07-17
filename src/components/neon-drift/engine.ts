import type { GameState, Player, Collectible, Obstacle, PowerUp, Particle, PowerUpKind, ActivePower } from "./types";
import { sfx } from "./audio";

const POWER_KINDS: PowerUpKind[] = ["shield", "magnet", "slow", "double", "dash", "freeze"];
const POWER_DURATION: Record<PowerUpKind, number> = {
  shield: 6, magnet: 8, slow: 5, double: 8, dash: 0, freeze: 3,
};
const POWER_HUE: Record<PowerUpKind, number> = {
  shield: 160, magnet: 300, slow: 220, double: 45, dash: 190, freeze: 260,
};
export const POWER_LABEL: Record<PowerUpKind, string> = {
  shield: "Shield", magnet: "Magnet", slow: "Slow Motion", double: "Double Score", dash: "Dash Ready", freeze: "Time Freeze",
};

export function createInitialState(w: number, h: number): GameState {
  return {
    player: {
      x: w / 2, y: h / 2, vx: 0, vy: 0,
      tx: w / 2, ty: h / 2, radius: 10,
      trail: [], dashCooldown: 0, dashTime: 0,
    },
    collectibles: [], obstacles: [], powerups: [], particles: [], floats: [], actives: [],
    score: 0, combo: 0, comboTimer: 0, time: 0,
    spawnTimer: 0, obsSpawnTimer: 1.2, powerTimer: 12,
    shake: 0, slowMo: 0, flash: 0,
    running: true, gameOver: false,
    width: w, height: h,
  };
}

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function dist2(ax: number, ay: number, bx: number, by: number) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

function spawnCollectible(s: GameState) {
  const roll = Math.random();
  const rarity: 1 | 2 | 3 = roll > 0.95 ? 3 : roll > 0.78 ? 2 : 1;
  const side = Math.floor(Math.random() * 4);
  const margin = 30;
  let x = rand(margin, s.width - margin), y = rand(margin, s.height - margin);
  if (side === 0) y = -20; if (side === 1) y = s.height + 20;
  if (side === 2) x = -20; if (side === 3) x = s.width + 20;
  const tx = rand(s.width * 0.2, s.width * 0.8), ty = rand(s.height * 0.2, s.height * 0.8);
  const dx = tx - x, dy = ty - y; const d = Math.hypot(dx, dy) || 1;
  const speed = rand(20, 40);
  s.collectibles.push({
    x, y, vx: (dx / d) * speed, vy: (dy / d) * speed,
    radius: 5 + rarity * 2, hue: rarity === 3 ? 45 : rarity === 2 ? 300 : 190,
    rarity, pulse: Math.random() * Math.PI * 2, alive: true,
  });
}

function spawnObstacle(s: GameState) {
  const diff = Math.min(1, s.time / 90);
  const speed = 40 + diff * 140 + Math.random() * 60;
  const size = rand(18, 34);
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0, vx = 0, vy = 0;
  if (side === 0) { x = rand(0, s.width); y = -size; vy = speed; vx = rand(-40, 40); }
  else if (side === 1) { x = rand(0, s.width); y = s.height + size; vy = -speed; vx = rand(-40, 40); }
  else if (side === 2) { x = -size; y = rand(0, s.height); vx = speed; vy = rand(-40, 40); }
  else { x = s.width + size; y = rand(0, s.height); vx = -speed; vy = rand(-40, 40); }
  s.obstacles.push({
    x, y, vx, vy, size, rot: Math.random() * Math.PI * 2, vrot: rand(-1.5, 1.5),
    sides: 3 + Math.floor(Math.random() * 4), hue: rand(0, 30),
  });
}

function spawnPowerUp(s: GameState) {
  const kind = POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];
  s.powerups.push({
    x: rand(60, s.width - 60), y: rand(60, s.height - 60),
    vx: rand(-15, 15), vy: rand(-15, 15),
    kind, pulse: 0, alive: true,
  });
}

function burst(s: GameState, x: number, y: number, hue: number, n = 14, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rand(40, 180) * power;
    s.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0, maxLife: rand(0.4, 0.9), size: rand(1.5, 3.5),
      hue: hue + rand(-20, 20), alpha: 1,
    });
  }
}

function trailPuff(s: GameState, p: Player) {
  s.particles.push({
    x: p.x + rand(-2, 2), y: p.y + rand(-2, 2),
    vx: -p.vx * 0.05 + rand(-8, 8), vy: -p.vy * 0.05 + rand(-8, 8),
    life: 0, maxLife: 0.5, size: rand(1, 2.5),
    hue: 190, alpha: 0.8,
  });
}

function hasActive(s: GameState, k: PowerUpKind) { return s.actives.some(a => a.kind === k); }
function addActive(s: GameState, k: PowerUpKind) {
  if (k === "dash") { s.player.dashCooldown = 0; return; }
  const existing = s.actives.find(a => a.kind === k);
  const dur = POWER_DURATION[k];
  if (existing) existing.time = dur;
  else s.actives.push({ kind: k, time: dur, duration: dur });
}

export function tryDash(s: GameState) {
  const p = s.player;
  if (p.dashCooldown > 0 || !s.running || s.gameOver) return;
  const dx = p.tx - p.x, dy = p.ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const power = 900;
  p.vx += (dx / d) * power;
  p.vy += (dy / d) * power;
  p.dashCooldown = 2.2;
  p.dashTime = 0.25;
  sfx.dash();
  burst(s, p.x, p.y, 190, 18, 0.8);
}

export function updateState(s: GameState, dtRaw: number) {
  if (!s.running || s.gameOver) {
    // still animate particles
    for (const pt of s.particles) {
      pt.life += dtRaw;
      pt.x += pt.vx * dtRaw; pt.y += pt.vy * dtRaw;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
    }
    s.particles = s.particles.filter(p => p.life < p.maxLife);
    return;
  }
  const timeScale = hasActive(s, "freeze") ? 0.05 : hasActive(s, "slow") ? 0.5 : 1;
  const dt = dtRaw * timeScale;
  s.time += dtRaw;
  s.shake = Math.max(0, s.shake - dtRaw * 4);
  s.flash = Math.max(0, s.flash - dtRaw * 4);

  const p = s.player;
  // inertia toward target
  const ax = (p.tx - p.x) * 12 - p.vx * 3.5;
  const ay = (p.ty - p.y) * 12 - p.vy * 3.5;
  p.vx += ax * dt; p.vy += ay * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = Math.max(p.radius, Math.min(s.width - p.radius, p.x));
  p.y = Math.max(p.radius, Math.min(s.height - p.radius, p.y));
  p.dashCooldown = Math.max(0, p.dashCooldown - dtRaw);
  p.dashTime = Math.max(0, p.dashTime - dtRaw);
  p.trail.unshift({ x: p.x, y: p.y, a: 1 });
  if (p.trail.length > 22) p.trail.pop();
  for (let i = 0; i < p.trail.length; i++) p.trail[i].a = 1 - i / p.trail.length;
  if (Math.random() < 0.6) trailPuff(s, p);

  // spawn
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    spawnCollectible(s);
    s.spawnTimer = Math.max(0.35, 0.9 - s.time / 120);
  }
  s.obsSpawnTimer -= dt;
  if (s.obsSpawnTimer <= 0) {
    spawnObstacle(s);
    s.obsSpawnTimer = Math.max(0.5, 2.0 - s.time / 60);
  }
  s.powerTimer -= dt;
  if (s.powerTimer <= 0) { spawnPowerUp(s); s.powerTimer = rand(10, 16); }

  // collectibles
  const magnet = hasActive(s, "magnet");
  for (const c of s.collectibles) {
    c.pulse += dt * 4;
    // gentle magnetic attraction to player when nearby
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = magnet ? 220 : 70;
    if (d < range) {
      const pull = magnet ? 260 : 90;
      c.vx += (dx / d) * pull * dt;
      c.vy += (dy / d) * pull * dt;
    }
    c.vx *= 0.99; c.vy *= 0.99;
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (d < p.radius + c.radius) {
      c.alive = false;
      s.combo += 1;
      s.comboTimer = 2.5;
      const mult = hasActive(s, "double") ? 2 : 1;
      const gain = c.rarity * 10 * mult * Math.max(1, Math.floor(s.combo / 3));
      s.score += gain;
      burst(s, c.x, c.y, c.hue, 12 + c.rarity * 4, 0.8 + c.rarity * 0.15);
      sfx.collect(c.rarity);
      if (s.combo > 1 && s.combo % 3 === 0) {
        sfx.combo(s.combo);
        s.floats.push({ x: p.x, y: p.y - 20, vy: -30, life: 0, maxLife: 1.2, text: `x${Math.floor(s.combo / 3) + 1}`, hue: 45, size: 22 });
      }
      s.floats.push({ x: c.x, y: c.y, vy: -20, life: 0, maxLife: 0.9, text: `+${gain}`, hue: c.hue, size: 14 });
    }
  }
  s.collectibles = s.collectibles.filter(c => c.alive && c.x > -40 && c.x < s.width + 40 && c.y > -40 && c.y < s.height + 40);

  // combo decay
  s.comboTimer -= dtRaw;
  if (s.comboTimer <= 0) s.combo = 0;

  // powerups
  for (const pu of s.powerups) {
    pu.pulse += dt * 3;
    pu.x += pu.vx * dt; pu.y += pu.vy * dt;
    if (pu.x < 20 || pu.x > s.width - 20) pu.vx *= -1;
    if (pu.y < 20 || pu.y > s.height - 20) pu.vy *= -1;
    if (dist2(pu.x, pu.y, p.x, p.y) < (p.radius + 16) ** 2) {
      pu.alive = false;
      addActive(s, pu.kind);
      sfx.power();
      burst(s, pu.x, pu.y, POWER_HUE[pu.kind], 26, 1.2);
      s.floats.push({ x: pu.x, y: pu.y - 10, vy: -30, life: 0, maxLife: 1.4, text: POWER_LABEL[pu.kind], hue: POWER_HUE[pu.kind], size: 16 });
    }
  }
  s.powerups = s.powerups.filter(pu => pu.alive);

  // obstacles
  for (const o of s.obstacles) {
    o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vrot * dt;
    if (o.x < o.size && o.vx < 0) o.vx *= -1;
    if (o.x > s.width - o.size && o.vx > 0) o.vx *= -1;
    if (o.y < o.size && o.vy < 0) o.vy *= -1;
    if (o.y > s.height - o.size && o.vy > 0) o.vy *= -1;
    if (dist2(o.x, o.y, p.x, p.y) < (p.radius + o.size * 0.7) ** 2) {
      if (hasActive(s, "shield")) {
        // consume shield
        s.actives = s.actives.filter(a => a.kind !== "shield");
        burst(s, p.x, p.y, 160, 30, 1.3);
        // knock obstacle away
        const dx = o.x - p.x, dy = o.y - p.y; const d = Math.hypot(dx, dy) || 1;
        o.vx = (dx / d) * 300; o.vy = (dy / d) * 300;
        s.shake = 0.5; s.flash = 0.4;
        sfx.power();
      } else {
        endGame(s);
      }
    }
  }
  s.obstacles = s.obstacles.filter(o => o.x > -80 && o.x < s.width + 80 && o.y > -80 && o.y < s.height + 80);

  // particles
  for (const pt of s.particles) {
    pt.life += dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
    pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
  }
  s.particles = s.particles.filter(pt => pt.life < pt.maxLife);

  // floats
  for (const f of s.floats) {
    f.life += dtRaw; f.y += f.vy * dtRaw; f.vy *= 0.98;
  }
  s.floats = s.floats.filter(f => f.life < f.maxLife);

  // actives tick
  for (const a of s.actives) a.time -= dtRaw;
  s.actives = s.actives.filter(a => a.time > 0);

  // passive scoring
  s.score += dtRaw * 2;
}

function endGame(s: GameState) {
  s.gameOver = true;
  s.running = false;
  s.shake = 1.2; s.flash = 1;
  burst(s, s.player.x, s.player.y, 20, 60, 2);
  sfx.hit(); setTimeout(() => sfx.over(), 200);
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { (navigator as any).vibrate?.([30, 40, 60]); } catch {}
  }
}

// ---------------- RENDER ----------------

export function render(ctx: CanvasRenderingContext2D, s: GameState, dpr: number, bgPhase: number) {
  const w = s.width, h = s.height;
  ctx.save();
  ctx.scale(dpr, dpr);

  // shake
  if (s.shake > 0) {
    ctx.translate((Math.random() - 0.5) * s.shake * 12, (Math.random() - 0.5) * s.shake * 12);
  }

  // background gradient
  const g = ctx.createLinearGradient(0, 0, w, h);
  const t = bgPhase;
  g.addColorStop(0, `hsl(${210 + Math.sin(t) * 10}, 40%, 8%)`);
  g.addColorStop(0.5, `hsl(${230 + Math.cos(t * 0.7) * 15}, 45%, 10%)`);
  g.addColorStop(1, `hsl(${260 + Math.sin(t * 0.5) * 10}, 40%, 9%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  const gs = 40;
  const ox = (t * 8) % gs;
  const oy = (t * 5) % gs;
  ctx.beginPath();
  for (let x = -ox; x < w; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = -oy; y < h; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // ambient dust
  for (let i = 0; i < 30; i++) {
    const x = ((i * 97 + t * 12) % w + w) % w;
    const y = ((i * 53 + t * 7) % h + h) % h;
    ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 3) * 0.02})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalCompositeOperation = "lighter";

  // collectibles
  for (const c of s.collectibles) {
    const pulse = 1 + Math.sin(c.pulse) * 0.15;
    const r = c.radius * pulse;
    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 4);
    grd.addColorStop(0, `hsla(${c.hue}, 100%, 75%, 0.9)`);
    grd.addColorStop(1, `hsla(${c.hue}, 100%, 55%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsla(${c.hue}, 100%, 92%, 1)`;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  }

  // powerups
  for (const pu of s.powerups) {
    const hue = POWER_HUE[pu.kind];
    const r = 14 + Math.sin(pu.pulse) * 2;
    const grd = ctx.createRadialGradient(pu.x, pu.y, 0, pu.x, pu.y, r * 3.5);
    grd.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.85)`);
    grd.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(pu.x, pu.y, r * 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2); ctx.stroke();
    // inner glyph
    ctx.fillStyle = `hsla(${hue}, 100%, 92%, 1)`;
    ctx.beginPath(); ctx.arc(pu.x, pu.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // obstacles
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.rot);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, o.size * 2.5);
    grd.addColorStop(0, `hsla(${o.hue}, 90%, 60%, 0.6)`);
    grd.addColorStop(1, `hsla(${o.hue}, 90%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, o.size * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${o.hue}, 100%, 70%, 0.95)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < o.sides; i++) {
      const a = (i / o.sides) * Math.PI * 2;
      const x = Math.cos(a) * o.size, y = Math.sin(a) * o.size;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  // particles
  for (const pt of s.particles) {
    ctx.fillStyle = `hsla(${pt.hue}, 100%, 75%, ${pt.alpha})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }

  // player trail
  const p = s.player;
  for (let i = p.trail.length - 1; i >= 0; i--) {
    const tr = p.trail[i];
    ctx.fillStyle = `hsla(190, 100%, 70%, ${tr.a * 0.25})`;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, p.radius * (0.5 + tr.a * 0.5), 0, Math.PI * 2); ctx.fill();
  }

  // shield ring
  if (hasActive(s, "shield")) {
    ctx.strokeStyle = `hsla(160, 100%, 70%, ${0.6 + Math.sin(s.time * 6) * 0.2})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 8 + Math.sin(s.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  // player glow
  const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 6);
  pg.addColorStop(0, "hsla(190, 100%, 80%, 0.95)");
  pg.addColorStop(0.4, "hsla(210, 100%, 65%, 0.35)");
  pg.addColorStop(1, "hsla(220, 100%, 60%, 0)");
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "hsla(200, 100%, 95%, 1)";
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  // floats
  for (const f of s.floats) {
    const a = 1 - f.life / f.maxLife;
    ctx.fillStyle = `hsla(${f.hue}, 100%, 80%, ${a})`;
    ctx.font = `600 ${f.size}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
  }

  // flash
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.4})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

function hasActiveExport(s: GameState, k: PowerUpKind) { return s.actives.some(a => a.kind === k); }
export { hasActiveExport as hasActive };
