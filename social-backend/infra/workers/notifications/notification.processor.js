import { supabase as supabaseService } from '../../../modules/auth/supabase.js';
import redisClient from '../../redis/redis.config.js';
import { getEmitter } from '../../websocket/emitter.js';
import RedisKeys from '../../redis/redis.key.js';

export const notificationProcessor = async (job) => {
  const { user_id, actor_id, type, action, group_key, target_url, metadata } = job.data;

  // 1. Fetch actor info for denormalization
  const { data: actor } = await supabaseService
    .from('users')
    .select('full_name, avatar_url')
    .eq('id', actor_id)
    .single();

  const enrichedMetadata = {
    ...metadata,
    actor_name: actor?.full_name || 'Người dùng',
    actor_avatar: actor?.avatar_url || null,
  };

  // 2. Lưu thông báo vào Database (PostgreSQL)
  const { data: notification, error } = await supabaseService
    .from('notifications')
    .insert([{
      user_id,
      actor_id,
      type,
      action,
      group_key,
      target_url,
      metadata: enrichedMetadata
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  // 3. Increment unread counter
  let deliveredRealtime = false;
  if (redisClient) {
    await redisClient.incr(RedisKeys.notifUnread(user_id));

    // 4. Kiểm tra trạng thái Online qua Redis
    const isOnline = await redisClient.exists(RedisKeys.userOnline(user_id));

    // 5. Push event qua Websocket nếu user đang online
    if (isOnline) {
      const emitter = getEmitter();
      // Emit event 'NEW_NOTIFICATION' tới room của user đó
      emitter.to(`user:${user_id}`).emit('NEW_NOTIFICATION', notification);
      
      const count = await redisClient.get(RedisKeys.notifUnread(user_id));
      emitter.to(`user:${user_id}`).emit('UNREAD_COUNT', { count: parseInt(count || '0', 10) });
      
      deliveredRealtime = true;
    }
  }

  return { success: true, notificationId: notification.id, deliveredRealtime };
};
