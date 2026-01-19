import redisService from "../redis/redis.service.js";

const postsRedis = {
  likePost: async (postId, userId) => {
    const likeUsersKey = `post:${postId}:like_users`;
    const likeCountKey = `post:${postId}:likes`;

    const liked = await redisService.sismember(likeUsersKey, userId);
    if (liked) return { liked: true };

    await redisService.sadd(likeUsersKey, userId);
    await redisService.incr(likeCountKey);

    return { liked: true };
  },

  unlikePost: async (postId, userId) => {
    const likeUsersKey = `post:${postId}:like_users`;
    const likeCountKey = `post:${postId}:likes`;

    const liked = await redisService.sismember(likeUsersKey, userId);
    if (!liked) return { liked: false };

    await redisService.srem(likeUsersKey, userId);
    await redisService.decr(likeCountKey);

    return { liked: false };
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
