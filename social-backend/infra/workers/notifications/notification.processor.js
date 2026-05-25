import { supabase as supabaseService } from '../../../modules/auth/supabase.js';
import redisClient from '../../redis/redis.config.js';
import { getEmitter } from '../../websocket/emitter.js';
import RedisKeys from '../../redis/redis.key.js';

export const notificationProcessor = async (job) => {
  if (job.name === 'FLUSH_NOTIFICATIONS') {
    if (!redisClient) {
      return { success: true, processed: 0 };
    }

    const BATCH_SIZE = 100;
    
    // 1. Pop atomically up to BATCH_SIZE items from the buffer using a multi transaction
    const pipeline = redisClient.multi();
    pipeline.lrange(RedisKeys.NOTIFICATION_BUFFER, 0, BATCH_SIZE - 1);
    pipeline.ltrim(RedisKeys.NOTIFICATION_BUFFER, BATCH_SIZE, -1);

    const pipelineResults = await pipeline.exec();
    const rawNotis = pipelineResults[0][1]; // Array of stringified JSON objects

    if (!rawNotis || rawNotis.length === 0) {
      return { success: true, processed: 0 };
    }

    const notiObjects = rawNotis.map(item => JSON.parse(item));

    // 2. Fetch actor info in parallel (denormalization for all unique actors in the batch)
    const uniqueActorIds = [...new Set(notiObjects.map(n => n.actor_id))];
    const { data: actors } = await supabaseService
      .from('users')
      .select('id, full_name, avatar')
      .in('id', uniqueActorIds);

    const actorMap = new Map(actors?.map(a => [a.id, a]) || []);

    const enrichedNotis = notiObjects.map(noti => {
      const actor = actorMap.get(noti.actor_id);
      return {
        user_id: noti.user_id,
        actor_id: noti.actor_id,
        type: noti.type,
        action: noti.action,
        group_key: noti.group_key,
        target_url: noti.target_url,
        metadata: {
          ...noti.metadata,
          actor_name: actor?.full_name || 'Người dùng',
          actor_avatar: actor?.avatar || null,
        }
      };
    });

    // 3. BULK INSERT all notifications in a SINGLE query!
    const { data: insertedNotis, error } = await supabaseService
      .from('notifications')
      .insert(enrichedNotis)
      .select();

    if (error) {
      throw new Error(`Failed to batch insert notifications: ${error.message}`);
    }

    // 4. Emit WebSockets and update unread counters in parallel
    const emitter = getEmitter();
    const updatePromises = insertedNotis.map(async (noti) => {
      const userId = noti.user_id;
      // Increment unread count in Redis
      await redisClient.incr(RedisKeys.notifUnread(userId));

      // Check online status
      const isOnline = await redisClient.exists(RedisKeys.userOnline(userId));
      if (isOnline) {
        // Emit socket realtime events
        emitter.to(`user:${userId}`).emit('NEW_NOTIFICATION', noti);
        const count = await redisClient.get(RedisKeys.notifUnread(userId));
        emitter.to(`user:${userId}`).emit('UNREAD_COUNT', { count: parseInt(count || '0', 10) });
      }
    });

    await Promise.allSettled(updatePromises);

    return { success: true, processed: insertedNotis.length };
  }

  // FALLBACK: Process individual 'dispatch' jobs (e.g. from tests or fallback path)
  const { user_id, actor_id, type, action, group_key, target_url, metadata } = job.data;

  // 1. Fetch actor info for denormalization
  const { data: actor } = await supabaseService
    .from('users')
    .select('full_name, avatar')
    .eq('id', actor_id)
    .single();

  const enrichedMetadata = {
    ...metadata,
    actor_name: actor?.full_name || 'Người dùng',
    actor_avatar: actor?.avatar || null,
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
