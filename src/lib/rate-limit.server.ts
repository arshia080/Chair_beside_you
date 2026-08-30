// ponytail: in-memory per-isolate fixed window, not shared across edge locations —
// swap for a DB or Durable Object counter if abuse crosses isolates.
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
