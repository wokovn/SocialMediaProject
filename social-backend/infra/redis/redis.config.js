import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

redis.on('error', (error) => {
  console.warn(`[redis] ${error.message}`);
});

/**
 * Bật Redis Hybrid Persistence (RDB + AOF) tại runtime.
 *
 * Hybrid = AOF file bắt đầu bằng RDB snapshot (load nhanh)
 * rồi replay thêm AOF commands (không mất dữ liệu).
 *
 * - appendonly yes      → bật AOF
 * - appendfsync everysec → flush AOF mỗi giây (cân bằng perf/safety)
 * - aof-use-rdb-preamble yes → bật Hybrid format
 * - save 3600 1 / 300 100 / 60 10000 → RDB snapshot triggers
 *
 * Lưu ý: CONFIG SET chỉ áp dụng cho session hiện tại.
 * Để cố định vĩnh viễn, thêm vào redis.conf hoặc gọi CONFIG REWRITE.
 */
export async function enableHybridPersistence() {
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