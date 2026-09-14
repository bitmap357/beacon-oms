/** Redis rate limits for login/reset/export. If REDIS_URL is missing, checks are skipped. */
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    globalForRedis.redis.connect().catch(() => undefined);
  }
  return globalForRedis.redis;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
) {
  const redis = getRedis();
  if (!redis) return { ok: true, remaining: limit };
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

export function clientKey(request: Request, extra = "") {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `rl:${ip}:${extra}`;
}
