import redisClient from '../../redis/redis.config.js';
import { supabase as supabaseService } from '../../../modules/auth/supabase.js';

export const rankingProcessor = async (job) => {
  const { postId, interactionType } = job.data;
  
  if (!postId || !interactionType) {
    throw new Error('Missing postId or interactionType');
  }

  // 1. Tăng bộ đếm Count-Min Sketch (Ở đây giả lập bằng hash để dễ query nếu không có module CMS)
  const interactionsKey = `post:interactions:${postId}`;
  const totalInteractionsKey = `post:interactions:total:${postId}`;
  
  // Các điểm trọng số cho từng loại tương tác (có thể đưa ra .env)
  const weights = {
    'CLICK': 1,
    'LIKE': 2,
    'COMMENT': 3,
    'SHARE': 4
  };
  
  const weight = weights[interactionType.toUpperCase()] || 1;
  
  // Tăng đếm tổng điểm tương tác (dùng INCRBY)
  const totalInteractions = await redisClient.incrby(totalInteractionsKey, weight);
  
  // 2. Lấy thông tin bài viết (created_at) để tính toán Time Decay
  let createdAtStr = await redisClient.get(`post:created_at:${postId}`);
  
  if (!createdAtStr) {
    // Nếu chưa có trong cache, query từ DB
    const { data: post, error } = await supabaseService
      .from('posts')
      .select('created_at')
      .eq('id', postId)
      .single();
      
    if (error || !post) {
      throw new Error(`Post ${postId} not found`);
    }
    createdAtStr = post.created_at;
    await redisClient.set(`post:created_at:${postId}`, createdAtStr, 'EX', 86400); // Lưu 1 ngày
  }
  
  // 3. Tính điểm (Time Decay Formula)
  const createdAt = new Date(createdAtStr).getTime();
  const now = Date.now();
  const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
  
  const decayFactor = parseFloat(process.env.RANKING_TIME_DECAY_FACTOR || '1.8');
  const cmsBonus = parseFloat(process.env.RANKING_CMS_BONUS_WEIGHT || '10');
  
  // Score = (Total_Interactions + CMS_Bonus) / (T + 2)^1.8
  const denominator = Math.pow(Math.max(0, hoursSinceCreated) + 2, decayFactor);
  const score = (totalInteractions + cmsBonus) / denominator;
  
  // 4. Lưu vào Sorted Set global_trending_feed
  await redisClient.zadd('global_trending_feed', score, postId);
  
  return { success: true, postId, score, totalInteractions };
};
