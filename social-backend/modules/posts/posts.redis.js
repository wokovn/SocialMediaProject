import redisService from "../../infra/redis/redis.service.js";
import RedisKeys from "../../infra/redis/redis.key.js";
import { addRankingJobWithThrottle } from "../../infra/queue/ranking.queue.js";

const postsRedis = {
  /**
   * Processes a "Like" action for a specific post.
   * Write-Behind strategy: updates cache immediately, buffers DB write asynchronously.
   */
  async likePost(postId, userId) {
      const pipeline = redisService.pipeline();

      // 1. Buffer write for async DB persistence
      const payload = JSON.stringify({ userId, postId, action: 'LIKE', timestamp: Date.now() });
      pipeline.rpush(RedisKeys.LIKE_BUFFER, payload);

      // 2. Update real-time cache (hot storage)
      pipeline.sadd(`post:${postId}:likes`, userId);

      // 3. Get updated count from the SET
      pipeline.scard(`post:${postId}:likes`);

      const results = await pipeline.exec();
      const likeCount = results[2][1];

      // 4. Trigger ranking engine — throttled to max 1 job/30s per post
      addRankingJobWithThrottle(postId, 'LIKE').catch(err => {
          console.error('[Ranking] Failed to enqueue LIKE interaction', err);
      });

      return { success: true, likeCount };
  },

  /**
   * Processes an "Unlike" action for a specific post.
   * [FIX B3] Now triggers ranking recalculation to avoid score inflation.
   */
  async unlikePost(postId, userId) {
      const pipeline = redisService.pipeline();

      // 1. Buffer write (UNLIKE)
      const payload = JSON.stringify({ userId, postId, action: 'UNLIKE', timestamp: Date.now() });
      pipeline.rpush(RedisKeys.LIKE_BUFFER, payload);

      // 2. Remove from SET
      pipeline.srem(`post:${postId}:likes`, userId);

      // 3. Get updated count
      pipeline.scard(`post:${postId}:likes`);

      const results = await pipeline.exec();
      const likeCount = results[2][1];

      // 4. [FIX B3] Trigger ranking engine with negative weight to reduce score
      addRankingJobWithThrottle(postId, 'UNLIKE').catch(err => {
          console.error('[Ranking] Failed to enqueue UNLIKE interaction', err);
      });

      return { success: true, likeCount };
  },

  /**
   * [FIX B1] Use SCARD (not GET) because post likes are stored in a Redis SET.
   * GET on a SET key always returns null → count was always 0 before this fix.
   */
  getLikeCount: async (postId) => {
    const count = await redisService.scard(`post:${postId}:likes`);
    return Number(count || 0);
  },

  getPost: async (postId) => {
    const key = `post:${postId}`;
    const post = await redisService.get(key);
    return post ? JSON.parse(post) : null;
  }
};

export default postsRedis;
