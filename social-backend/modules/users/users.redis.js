import redisService from '../../infra/redis/redis.service.js';
import RedisKeys from '../../infra/redis/redis.key.js';

const usersRedis = {
  async followUser({ followerId, followingId }) {
    const pipeline = redisService.pipeline();
    const payload = JSON.stringify({
      followerId,
      followingId,
      action: 'FOLLOW',
      timestamp: Date.now(),
    });

    pipeline.rpush(RedisKeys.FOLLOW_BUFFER, payload);
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
  },

  async unfollowUser({ followerId, followingId }) {
    const pipeline = redisService.pipeline();
    const payload = JSON.stringify({
      followerId,
      followingId,
      action: 'UNFOLLOW',
      timestamp: Date.now(),
    });

    pipeline.rpush(RedisKeys.FOLLOW_BUFFER, payload);
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
  },
};

export default usersRedis;
