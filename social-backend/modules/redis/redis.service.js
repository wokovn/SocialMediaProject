import redis from "./redis.config.js";

const redisService = {
  get: (key) => redis.get(key),
  set: (key, value, ttl) =>
    ttl ? redis.set(key, value, "EX", ttl) : redis.set(key, value),

  del: (key) => redis.del(key),

  incr: (key) => redis.incr(key),
  decr: (key) => redis.decr(key),

  sadd: (key, value) => redis.sadd(key, value),
  srem: (key, value) => redis.srem(key, value),
  sismember: (key, value) => redis.sismember(key, value),

  expire: (key, ttl) => redis.expire(key, ttl),
};

export default redisService;
