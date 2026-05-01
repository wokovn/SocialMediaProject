import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag: set REDIS_ENABLED=false in .env to skip Redis entirely.
// When false, this module exports null and redis.service.js falls back to
// safe defaults on every call — no fake stub, real error-path logic.
// ─────────────────────────────────────────────────────────────────────────────
export const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

let redis = null;

if (!isRedisEnabled) {
  console.warn('[redis] ⚠️  REDIS_ENABLED=false — skipping connection. Running in degraded mode.');
} else {
  let lastErrorTime = 0;
  const ERROR_LOG_INTERVAL = 30000; // ms between repeated error logs

  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    // null = BullMQ requirement; individual command timeouts managed by retryStrategy
    maxRetriesPerRequest: null,
    // Retry indefinitely so a transient outage doesn't permanently close the client.
    // Cap at 10 s between attempts to avoid log spam.
    retryStrategy(times) {
      return Math.min(times * 200, 10_000);
    },
  });

  redis.on('error', (err) => {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
      console.warn(`[redis] ${err.message} (logs silenced for ${ERROR_LOG_INTERVAL / 1000}s)`);
      lastErrorTime = now;
    }
  });

  redis.on('connect', () => {
    if (lastErrorTime > 0) {
      console.log('[redis] ✅ Reconnected successfully.');
      lastErrorTime = 0;
    }
  });
}

/**
 * Bật Redis Hybrid Persistence (RDB + AOF) tại runtime.
 *
 * Hybrid = AOF file bắt đầu bằng RDB snapshot (load nhanh)
 * rồi replay thêm AOF commands (không mất dữ liệu).
 *
 * - appendonly yes       → bật AOF
 * - appendfsync everysec → flush AOF mỗi giây (cân bằng perf/safety)
 * - aof-use-rdb-preamble yes → bật Hybrid format
 * - save 3600 1 / 300 100 / 60 10000 → RDB snapshot triggers
 *
 * Lưu ý: CONFIG SET chỉ áp dụng cho session hiện tại.
 * Để cố định vĩnh viễn, thêm vào redis.conf hoặc gọi CONFIG REWRITE.
 */
export async function enableHybridPersistence() {
  if (!redis) return;
  try {
    await redis.config('SET', 'appendonly', 'yes');
    await redis.config('SET', 'appendfsync', 'everysec');
    await redis.config('SET', 'aof-use-rdb-preamble', 'yes');
    // RDB triggers: save sau 1h nếu có ≥1 write, sau 5p nếu ≥100, sau 1p nếu ≥10000
    await redis.config('SET', 'save', '3600 1 300 100 60 10000');
    console.log('[Redis] ✅ Hybrid Persistence (RDB + AOF) đã được bật.');
  } catch (err) {
    // Một số managed Redis (ví dụ: Upstash) không cho phép CONFIG SET
    console.warn(`[Redis] ⚠️ Không thể bật Hybrid Persistence: ${err.message}`);
    console.warn('[Redis]    → Nếu dùng managed Redis, hãy bật persistence trong dashboard.');
  }
}

export default redis;