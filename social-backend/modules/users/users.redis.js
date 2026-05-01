import redisService from '../../infra/redis/redis.service.js';
import RedisKeys from '../../infra/redis/redis.key.js';
import db from '../db/db.js';
import { follows } from '../db/schemas/index.js';
import { eq, and } from 'drizzle-orm';

const usersRedis = {
  // Write-Behind: buffer vào Redis, sync DB async qua worker
  // Fallback khi Redis sập: ghi thẳng DB (trigger tự tăng followers/following count)
  async followUser({ followerId, followingId }) {
    try {
      const pipeline = redisService.pipeline();
      pipeline.rpush(RedisKeys.FOLLOW_BUFFER, JSON.stringify({ followerId, followingId, action: 'FOLLOW', timestamp: Date.now() }));
      pipeline.sadd(`user:${followerId}:following`, followingId);
      pipeline.sadd(`user:${followingId}:followers`, followerId);
      pipeline.scard(`user:${followerId}:following`);
      pipeline.scard(`user:${followingId}:followers`);
      const results = await pipeline.exec();
      const followingAdded = Number(results[1]?.[1] || 0);
      const followersAdded = Number(results[2]?.[1] || 0);
      return {
        success: true,
        didChange: followingAdded === 1 || followersAdded === 1,
        followingCount: Number(results[3]?.[1] || 0),
        followersCount: Number(results[4]?.[1] || 0),
      };
    } catch (err) {
      console.warn('[Follow] Redis unavailable, falling back to DB:', err.message);
      const result = await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing().returning({ id: follows.id });
      return { success: true, didChange: result.length > 0, followingCount: 0, followersCount: 0 };
    }
  },

  // Fallback khi Redis sập: xóa thẳng DB (trigger tự giảm followers/following count)
  async unfollowUser({ followerId, followingId }) {
    try {
      const pipeline = redisService.pipeline();
      pipeline.rpush(RedisKeys.FOLLOW_BUFFER, JSON.stringify({ followerId, followingId, action: 'UNFOLLOW', timestamp: Date.now() }));
      pipeline.srem(`user:${followerId}:following`, followingId);
      pipeline.srem(`user:${followingId}:followers`, followerId);
      pipeline.scard(`user:${followerId}:following`);
      pipeline.scard(`user:${followingId}:followers`);
      const results = await pipeline.exec();
      const followingRemoved = Number(results[1]?.[1] || 0);
      const followersRemoved = Number(results[2]?.[1] || 0);
      return {
        success: true,
        didChange: followingRemoved === 1 || followersRemoved === 1,
        followingCount: Number(results[3]?.[1] || 0),
        followersCount: Number(results[4]?.[1] || 0),
      };
    } catch (err) {
      console.warn('[Unfollow] Redis unavailable, falling back to DB:', err.message);
      await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return { success: true, didChange: true, followingCount: 0, followersCount: 0 };
    }
  },
};

export default usersRedis;
