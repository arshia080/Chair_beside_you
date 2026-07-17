export type Vec = { x: number; y: number };

export type PowerUpKind = "shield" | "magnet" | "slow" | "double" | "dash" | "freeze";

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; hue: number; alpha: number;
}

export interface Collectible {
  x: number; y: number; vx: number; vy: number;
  radius: number; hue: number; rarity: 1 | 2 | 3; pulse: number; alive: boolean;
}

export interface Obstacle {
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vrot: number; sides: number; hue: number;
}

export interface PowerUp {
  x: number; y: number; vx: number; vy: number;
  kind: PowerUpKind; pulse: number; alive: boolean;
}

export interface FloatingText {
  x: number; y: number; vy: number; life: number; maxLife: number;
  text: string; hue: number; size: number;
}

export interface Player {
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number;
  radius: number; trail: Array<{ x: number; y: number; a: number }>;
  dashCooldown: number; dashTime: number;
}

export interface ActivePower {
  kind: PowerUpKind; time: number; duration: number;
}

export interface GameState {
  player: Player;
  collectibles: Collectible[];
  obstacles: Obstacle[];
  powerups: PowerUp[];
  particles: Particle[];
  floats: FloatingText[];
  actives: ActivePower[];
  score: number;
  combo: number;
  comboTimer: number;
  time: number;
  spawnTimer: number;
  obsSpawnTimer: number;
  powerTimer: number;
  shake: number;
  slowMo: number;
  flash: number;
  running: boolean;
  gameOver: boolean;
  width: number;
  height: number;
}
