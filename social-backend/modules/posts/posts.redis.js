import redisService from "../../infra/redis/redis.service.js";
import RedisKeys from "../../infra/redis/redis.key.js";
import { addRankingJobWithThrottle } from "../../infra/queue/ranking.queue.js";
import db from "../db/db.js";
import { likes, posts } from "../db/schemas/index.js";
import { eq, and } from "drizzle-orm";
import { dispatchNotification } from "../notifications/notifications.service.js";

const postsRedis = {
  // Write-Behind: buffer vào Redis, sync DB async qua worker
  // Fallback khi Redis sập: ghi thẳng DB (trigger tự tăng likes_count)
  async likePost(postId, userId) {
    try {
      const [post] = await db.select({ 
        userId: posts.userId, 
        content: posts.content 
      }).from(posts).where(eq(posts.id, postId)).limit(1);

      if (post) {
        dispatchNotification({
          userId: post.userId,
          actorId: userId,
          type: 'INTERACTION',
          action: 'LIKE',
          targetId: postId,
          targetUrl: `/post/${postId}`,
          metadata: { postTitle: post.content?.substring(0, 80) || '' }
        });
      }

      const pipeline = redisService.pipeline();
      pipeline.rpush(RedisKeys.LIKE_BUFFER, JSON.stringify({ userId, postId, action: 'LIKE', timestamp: Date.now() }));
      pipeline.sadd(RedisKeys.postLikes(postId), userId);
      pipeline.scard(RedisKeys.postLikes(postId));
      const results = await pipeline.exec();
      addRankingJobWithThrottle(postId, 'LIKE').catch(err => console.error('[Ranking]', err));
      return { success: true, likeCount: results[2][1] };
    } catch (err) {
      console.warn('[Like] Redis unavailable, falling back to DB:', err.message);
      await db.insert(likes).values({ userId, postId, commentId: null }).onConflictDoNothing();
      const [fallbackPost] = await db.select({ likesCount: posts.likesCount }).from(posts).where(eq(posts.id, postId)).limit(1);
      addRankingJobWithThrottle(postId, 'LIKE').catch(err => console.error('[Ranking]', err));
      return { success: true, likeCount: fallbackPost?.likesCount ?? 0 };
    }
  },

  // [FIX B3] UNLIKE triggers ranking recalculation để tránh score inflation
  // Fallback khi Redis sập: xóa thẳng DB (trigger tự giảm likes_count)
  async unlikePost(postId, userId) {
    try {
      const pipeline = redisService.pipeline();
      pipeline.rpush(RedisKeys.LIKE_BUFFER, JSON.stringify({ userId, postId, action: 'UNLIKE', timestamp: Date.now() }));
      pipeline.srem(RedisKeys.postLikes(postId), userId);
      pipeline.scard(RedisKeys.postLikes(postId));
      const results = await pipeline.exec();
      addRankingJobWithThrottle(postId, 'UNLIKE').catch(err => console.error('[Ranking]', err));
      return { success: true, likeCount: results[2][1] };
    } catch (err) {
      console.warn('[Unlike] Redis unavailable, falling back to DB:', err.message);
      await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
      const [post] = await db.select({ likesCount: posts.likesCount }).from(posts).where(eq(posts.id, postId)).limit(1);
      addRankingJobWithThrottle(postId, 'UNLIKE').catch(err => console.error('[Ranking]', err));
      return { success: true, likeCount: post?.likesCount ?? 0 };
    }
  },

  // [FIX B1] Likes lưu dạng SET → dùng SCARD thay vì GET
  getLikeCount: async (postId) => {
    try {
      const count = await redisService.scard(RedisKeys.postLikes(postId));
      return Number(count || 0);
    } catch (err) {
      console.warn('[Like] Redis unavailable for getLikeCount, reading from DB:', err.message);
      const [post] = await db.select({ likesCount: posts.likesCount }).from(posts).where(eq(posts.id, postId)).limit(1);
      return post?.likesCount ?? 0;
    }
  },

  getPost: async (postId) => {
    try {
      const cached = await redisService.get(RedisKeys.post(postId));
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      return null;
    }
  },
};

export default postsRedis;
