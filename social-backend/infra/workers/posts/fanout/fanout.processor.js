import redisClient from '../../../redis/redis.config.js';
import db from '../../../../modules/db/db.js';
import follows from '../../../../modules/db/schemas/follows.schema.js';
import users from '../../../../modules/db/schemas/users.schema.js';
import { eq, sql } from 'drizzle-orm';

export const fanoutProcessor = async (job) => {
  const { postId, userId } = job.data;
  
  if (!postId || !userId) {
    throw new Error('Missing postId or userId');
  }

  const idolThreshold = parseInt(process.env.IDOL_FOLLOWER_THRESHOLD || '50000', 10);
  const maxFeedSize = parseInt(process.env.MAX_FEED_SIZE || '1000', 10);

  // 1. Kiểm tra số lượng follower của user này
  const [userStats] = await db
    .select({ followersCount: sql`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, userId));
    
  const followersCount = Number(userStats?.followersCount || 0);

  // 2. Logic phân phối
  if (followersCount >= idolThreshold) {
    // PULL MODEL: User là Idol, chỉ lưu vào idol_posts
    await redisClient.lpush(`idol_posts:${userId}`, postId);
    await redisClient.ltrim(`idol_posts:${userId}`, 0, maxFeedSize - 1);
    
    // (Optional) Gửi notification cho fan cứng nếu muốn
  } else {
    // PUSH MODEL: Lấy danh sách follower và đẩy vào user_feed của họ
    const followers = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, userId));
      
    if (followers.length > 0) {
      const pipeline = redisClient.pipeline();
      followers.forEach(f => {
        const feedKey = `user_feed:${f.id}`;
        pipeline.lpush(feedKey, postId);
        pipeline.ltrim(feedKey, 0, maxFeedSize - 1);
      });
      await pipeline.exec();
    }
  }

  return { success: true, postId, isIdol: followersCount >= idolThreshold, fanoutCount: followersCount };
};
