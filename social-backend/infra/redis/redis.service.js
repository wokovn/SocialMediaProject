import redis from "./redis.config.js";

// ─────────────────────────────────────────────────────────────────────────────
// redis.service.js — thin wrapper with automatic fallback.
//
// Every method checks whether the client is available (redis !== null) and
// wraps the actual call in try/catch. If Redis is disabled (REDIS_ENABLED=false)
// or a live call fails (ECONNREFUSED, "Connection is closed", etc.), the method
// returns a safe default so callers don't need to handle connection errors
// themselves — their existing DB-fallback logic in the catch block takes over.
//
// Safe defaults mirror what callers already expect:
//   null  → "cache miss" (triggers a DB read in the caller)
//   0     → numeric count
//   []    → empty list / set
// ─────────────────────────────────────────────────────────────────────────────

const unavailable = () => redis === null;

const redisService = {
  // ── Strings ────────────────────────────────────────────────────────────────
  async get(key) {
    if (unavailable()) return null;
    try { return await redis.get(key); } catch { return null; }
  },

  async set(key, value, ttl) {
    if (unavailable()) return null;
    try {
      return ttl
        ? await redis.set(key, value, 'EX', ttl)
        : await redis.set(key, value);
    } catch { return null; }
  },

  async del(key) {
    if (unavailable()) return 0;
    try { return await redis.del(key); } catch { return 0; }
  },

  // ── Counters ───────────────────────────────────────────────────────────────
  async incr(key) {
    if (unavailable()) return 0;
    try { return await redis.incr(key); } catch { return 0; }
  },

  async decr(key) {
    if (unavailable()) return 0;
    try { return await redis.decr(key); } catch { return 0; }
  },

  async incrby(key, amount) {
    if (unavailable()) return 0;
    try { return await redis.incrby(key, amount); } catch { return 0; }
  },

  // ── TTL / meta ─────────────────────────────────────────────────────────────
  async expire(key, ttl) {
    if (unavailable()) return 0;
    try { return await redis.expire(key, ttl); } catch { return 0; }
  },

  async ttl(key) {
    if (unavailable()) return -2;
    try { return await redis.ttl(key); } catch { return -2; }
  },

  async type(key) {
    if (unavailable()) return 'none';
    try { return await redis.type(key); } catch { return 'none'; }
  },

  // ── Sets ───────────────────────────────────────────────────────────────────
  async sadd(key, value) {
    if (unavailable()) return 0;
    try { return await redis.sadd(key, value); } catch { return 0; }
  },

  async srem(key, value) {
    if (unavailable()) return 0;
    try { return await redis.srem(key, value); } catch { return 0; }
  },

  async sismember(key, value) {
    if (unavailable()) return 0;
    try { return await redis.sismember(key, value); } catch { return 0; }
  },

  async scard(key) {
    if (unavailable()) return 0;
    try { return await redis.scard(key); } catch { return 0; }
  },

  async smembers(key) {
    if (unavailable()) return [];
    try { return await redis.smembers(key); } catch { return []; }
  },

  // ── Sorted Sets ────────────────────────────────────────────────────────────
  async zadd(key, score, member) {
    if (unavailable()) return 0;
    try { return await redis.zadd(key, score, member); } catch { return 0; }
  },

  async zrevrange(key, start, stop, withScores) {
    if (unavailable()) return [];
    try {
      return withScores
        ? await redis.zrevrange(key, start, stop, 'WITHSCORES')
        : await redis.zrevrange(key, start, stop);
    } catch { return []; }
  },

  async zscore(key, member) {
    if (unavailable()) return null;
    try { return await redis.zscore(key, member); } catch { return null; }
  },

  async zrem(key, member) {
    if (unavailable()) return 0;
    try { return await redis.zrem(key, member); } catch { return 0; }
  },

  async zremrangebyrank(key, start, stop) {
    if (unavailable()) return 0;
    try { return await redis.zremrangebyrank(key, start, stop); } catch { return 0; }
  },

  async zcard(key) {
    if (unavailable()) return 0;
    try { return await redis.zcard(key); } catch { return 0; }
  },

  // ── Lists ──────────────────────────────────────────────────────────────────
  async rpush(key, value) {
    if (unavailable()) return 0;
    try { return await redis.rpush(key, value); } catch { return 0; }
  },

  async lpush(key, value) {
    if (unavailable()) return 0;
    try { return await redis.lpush(key, value); } catch { return 0; }
  },

  async lpop(key) {
    if (unavailable()) return null;
    try { return await redis.lpop(key); } catch { return null; }
  },

  async rpop(key) {
    if (unavailable()) return null;
    try { return await redis.rpop(key); } catch { return null; }
  },

  async lrange(key, start, stop) {
    if (unavailable()) return [];
    try { return await redis.lrange(key, start, stop); } catch { return []; }
  },

  async llen(key) {
    if (unavailable()) return 0;
    try { return await redis.llen(key); } catch { return 0; }
  },

  // ── Pipeline ───────────────────────────────────────────────────────────────
  // Returns a real pipeline when available. When unavailable, returns a chainable
  // stub whose exec() resolves to [] — callers that index results[n]?.[1] safely
  // get undefined and fall through to their DB fallback.
  pipeline() {
    if (unavailable()) {
      const stub = new Proxy({}, {
        get(_, prop) {
          if (prop === 'exec') return () => Promise.reject(new Error("Redis is disabled"));
          return () => stub; // chain any unknown method
        },
      });
      return stub;
    }
    return redis.pipeline();
  },
};

export default redisService;
