import { supabase as supabaseService } from '../../../modules/auth/supabase.js';
import redisClient from '../../redis/redis.config.js';
import { getEmitter } from '../../websocket/emitter.js';

export const notificationProcessor = async (job) => {
  const { user_id, actor_id, type, action, target_url, metadata } = job.data;

  // 1. Lưu thông báo vào Database (PostgreSQL)
  const { data: notification, error } = await supabaseService
    .from('notifications')
    .insert([{
      user_id,
      actor_id,
      type,
      action,
      target_url,
      metadata
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  // 2. Kiểm tra trạng thái Online qua Redis
  const isOnline = await redisClient.exists(`user:online:${user_id}`);

  // 3. Push event qua Websocket nếu user đang online
  if (isOnline) {
    const emitter = getEmitter();
    // Emit event 'NEW_NOTIFICATION' tới room của user đó
    emitter.to(`user:${user_id}`).emit('NEW_NOTIFICATION', notification);
  }

  return { success: true, notificationId: notification.id, deliveredRealtime: !!isOnline };
};
