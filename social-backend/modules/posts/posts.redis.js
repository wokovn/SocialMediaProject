import redisService from "../../infra/redis/redis.service.js";
import RedisKeys from "../../infra/redis/redis.key.js";

const postsRedis = {
/**
   * Processes a "Like" action for a specific post.
   * Utilizes a Write-Behind strategy: updates the cache immediately for real-time feedback
   * while buffering the write operation for asynchronous persistence to the database.
   *
   * @param {string} postId - The unique identifier of the post.
   * @param {string} userId - The unique identifier of the user performing the action.
   * @returns {Promise<{success: boolean, likeCount: number}>} - The result status and updated like count.
   */
  async likePost(postId, userId) {
      // Initialize a Redis pipeline to execute multiple commands in a single network round-trip.
      // This optimizes latency by reducing RTT (Round Trip Time).
      const pipeline = redisService.pipeline();

      // 1. Buffer the Write Operation:
      // Serialize the event data and append it to the tail of the buffer list (RPUSH).
      // This queue will be consumed by a background worker for batched database insertion.
      const payload = JSON.stringify({
          userId,
          postId,
          action: 'LIKE',
          timestamp: Date.now()
      });
      pipeline.rpush(RedisKeys.LIKE_BUFFER, payload);

      // 2. Update Real-time Cache (Hot Storage):
      // Add the user ID to the set of likes for this post (SADD) to ensure immediate data consistency in the cache.
      pipeline.sadd(`post:${postId}:likes`, userId);

      // 3. Retrieve Updated Metric:
      // Get the current cardinality (size) of the set to return the updated like count to the client.
      pipeline.scard(`post:${postId}:likes`);

      // Execute all queued commands atomically.
      const results = await pipeline.exec();

      // Extract the result of the SCARD command (located at index 2 in the pipeline results).
      // The result format is [error, value]. We assume success for the count retrieval.
      const likeCount = results[2][1];

      return { success: true, likeCount };
  },

  /**
   * Processes an "Unlike" action for a specific post.
   * Mirrors the logic of `likePost` but removes the user from the cache and flags the action as 'UNLIKE'.
   *
   * @param {string} postId - The unique identifier of the post.
   * @param {string} userId - The unique identifier of the user.
   * @returns {Promise<{success: boolean, likeCount: number}>}
   */
  async unlikePost(postId, userId) {
      const pipeline = redisService.pipeline();

      // 1. Buffer the Write Operation (Action: UNLIKE).
      const payload = JSON.stringify({
          userId,
          postId,
          action: 'UNLIKE',
          timestamp: Date.now()
      });
      pipeline.rpush(RedisKeys.LIKE_BUFFER, payload);

      // 2. Update Real-time Cache:
      // Remove the user ID from the set (SREM).
      pipeline.srem(`post:${postId}:likes`, userId);

      // 3. Retrieve Updated Metric.
      pipeline.scard(`post:${postId}:likes`);

      // Execute execution.
      const results = await pipeline.exec();
      
      // Extract the updated count from the SCARD result.
      const likeCount = results[2][1];

      return { success: true, likeCount };
  },
  getLikeCount: async (postId) => {
    const key = `post:${postId}:likes`;
    const count = await redisService.get(key);
    return Number(count || 0);
  },
  getPost: async (postId) => {
    const key = `post:${postId}`;
    const post = await redisService.get(key);
    return post ? JSON.parse(post) : null;
  }
};

export default postsRedis;
