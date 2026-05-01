import redisService from '../../infra/redis/redis.service.js';
import RedisKeys from '../../infra/redis/redis.key.js';
import db from '../db/db.js';
import { comments, posts } from '../db/schemas/index.js';
import { eq } from 'drizzle-orm';

const commentRedis = {
  // Write-Behind: buffer vào Redis, sync DB async qua worker
  // Fallback khi Redis sập: ghi thẳng DB (trigger tự tăng comments_count và replies_count)
  async postComment({ commentId, userId, postId, content, parentId = null }) {
    try {
      const pipeline = redisService.pipeline();
      pipeline.rpush(RedisKeys.COMMENT_BUFFER, JSON.stringify({
        commentId, userId, postId, parentId, content,
        action: 'COMMENT_CREATE', timestamp: Date.now(),
      }));
      pipeline.incr(`post:${postId}:comments`);
      if (parentId) pipeline.incr(`comment:${parentId}:replies`);

      const results = await pipeline.exec();
      return {
        success: true,
        commentCount: Number(results[1]?.[1] || 0),
        repliesCount: parentId ? Number(results[2]?.[1] || 0) : null,
      };
    } catch (err) {
      console.warn('[Comment] Redis unavailable, falling back to DB:', err.message);
      await db.insert(comments).values({ id: commentId, userId, postId, parentId: parentId || null, content });
      const [updatedPost] = await db.select({ commentsCount: posts.commentsCount }).from(posts).where(eq(posts.id, postId)).limit(1);
      return { success: true, commentCount: updatedPost?.commentsCount ?? 0, repliesCount: null };
    }
  },
};

export default commentRedis;
