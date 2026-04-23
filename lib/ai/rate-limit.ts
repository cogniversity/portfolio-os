type Capability = "draft" | "children" | "describe";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

const CAPACITY: Record<Capability, number> = {
  draft: 6,
  children: 15,
  describe: 30,
};
const REFILL_MS: Record<Capability, number> = {
  draft: 60_000,
  children: 60_000,
  describe: 60_000,
};

function key(userId: string, cap: Capability): string {
  return `${userId}:${cap}`;
}

export function takeToken(userId: string, cap: Capability): boolean {
  const k = key(userId, cap);
  const now = Date.now();
  const capacity = CAPACITY[cap];
  const refillMs = REFILL_MS[cap];
  let bucket = buckets.get(k);
  if (!bucket) {
    bucket = { tokens: capacity, updatedAt: now };
    buckets.set(k, bucket);
  }
  const elapsed = now - bucket.updatedAt;
  if (elapsed > 0) {
    const refill = (elapsed / refillMs) * capacity;
    bucket.tokens = Math.min(capacity, bucket.tokens + refill);
    bucket.updatedAt = now;
  }
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export class RateLimitError extends Error {
  constructor(capability: Capability) {
    super(`Too many ${capability} requests. Please wait a moment and try again.`);
    this.name = "RateLimitError";
  }
}

export function assertRate(userId: string, cap: Capability): void {
  if (!takeToken(userId, cap)) throw new RateLimitError(cap);
}
