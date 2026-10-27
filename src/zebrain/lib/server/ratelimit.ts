import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
// Simple per-user, per-route rate limit kept in the server's memory. Enough to stop one account hammering paid
// routes from a single instance; a shared store (e.g. Upstash Redis) is needed once Zebrain runs on many instances.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return true;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) hits.clear();
  return false;
}
