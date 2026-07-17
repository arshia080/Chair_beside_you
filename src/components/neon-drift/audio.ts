let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.4;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); }
export function isMuted() { return muted; }
export function getVolume() { return volume; }

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2, sweepTo?: number) {
  if (muted) return;
  const c = ac(); if (!c) return;
  if (c.state === "suspended") c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain * volume, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.05);
}

export const sfx = {
  collect: (rarity = 1) => tone(660 + rarity * 220, 0.18, "sine", 0.12, 1200 + rarity * 200),
  combo: (n: number) => tone(500 + n * 60, 0.22, "triangle", 0.14, 900 + n * 80),
  power: () => { tone(440, 0.25, "sine", 0.15, 880); setTimeout(() => tone(660, 0.25, "sine", 0.12, 1320), 60); },
  dash: () => tone(880, 0.14, "sawtooth", 0.08, 220),
  hit: () => tone(180, 0.4, "sawtooth", 0.22, 60),
  over: () => { tone(300, 0.5, "sine", 0.2, 90); setTimeout(() => tone(200, 0.6, "sine", 0.18, 60), 120); },
  ui: () => tone(720, 0.06, "sine", 0.08),
};
