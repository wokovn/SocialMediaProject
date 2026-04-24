import redisService from '../../infra/redis/redis.service.js';
import RedisKeys from '../../infra/redis/redis.key.js';

const commentRedis = {
  async postComment({ commentId, userId, postId, content, parentId = null }) {
    const pipeline = redisService.pipeline();
    const payload = JSON.stringify({
      commentId,
      userId,
      postId,
      parentId,
      content,
      action: 'COMMENT_CREATE',
      timestamp: Date.now(),
    });

    pipeline.rpush(RedisKeys.COMMENT_BUFFER, payload);
    pipeline.incr(`post:${postId}:comments`);

    if (parentId) {
      pipeline.incr(`comment:${parentId}:replies`);
    }

    const results = await pipeline.exec();
    const commentCount = Number(results[1]?.[1] || 0);
    const repliesCount = parentId ? Number(results[2]?.[1] || 0) : null;

    return {
      success: true,
      commentCount,
      repliesCount,
    };
  },
};

export default commentRedis;
