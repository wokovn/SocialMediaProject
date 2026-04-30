import redis from "./redis.config.js";

const redisService = {
  get: (key) => redis.get(key),
  set: (key, value, ttl) =>
    ttl ? redis.set(key, value, "EX", ttl) : redis.set(key, value),

  del: (key) => redis.del(key),

  incr: (key) => redis.incr(key),
  decr: (key) => redis.decr(key),
  incrby: (key, amount) => redis.incrby(key, amount),

  // Sets
  sadd: (key, value) => redis.sadd(key, value),
  srem: (key, value) => redis.srem(key, value),
  sismember: (key, value) => redis.sismember(key, value),
  scard: (key) => redis.scard(key),

  // Sorted Sets
  zadd: (key, score, member) => redis.zadd(key, score, member),
  zrevrange: (key, start, stop, withScores) => 
    withScores ? redis.zrevrange(key, start, stop, "WITHSCORES") : redis.zrevrange(key, start, stop),
  zscore: (key, member) => redis.zscore(key, member),
  zrem: (key, member) => redis.zrem(key, member),

  // Lists
  rpush: (key, value) => redis.rpush(key, value),
  lpush: (key, value) => redis.lpush(key, value),
  lpop: (key) => redis.lpop(key),
  rpop: (key) => redis.rpop(key),
  lrange: (key, start, stop) => redis.lrange(key, start, stop),

  expire: (key, ttl) => redis.expire(key, ttl),

  pipeline: () => redis.pipeline(),
};

export default redisService;

