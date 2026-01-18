// auth.redis.js
import jwt from "jsonwebtoken";
import redisService from "../redis/redis.service.js";

const authRedis = {
  blacklistToken: async (token) => {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;

    const key = `jwt:blacklist:${token}`;
    await redisService.set(key, "1", ttl);
  },

  isBlacklisted: async (token) => {
    const key = `jwt:blacklist:${token}`;
    const value = await redisService.get(key);
    return Boolean(value);
  },
};

export default authRedis;
