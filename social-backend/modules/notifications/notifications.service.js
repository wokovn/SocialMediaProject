import { notificationQueue } from '../../infra/queue/notification.queue.js';
import redisClient from '../../infra/redis/redis.config.js';
import RedisKeys from '../../infra/redis/redis.key.js';

/**
 * Dispatch a notification to the queue to be processed in the background
 * @param {Object} params
 * @param {string} params.userId - User receiving the notification
 * @param {string} params.actorId - User performing the action
 * @param {string} params.type - Category of notification (e.g. 'INTERACTION', 'SOCIAL')
 * @param {string} params.action - Specific action (e.g. 'LIKE', 'COMMENT', 'FOLLOW')
 * @param {string} params.targetId - ID of the target resource (e.g. postId)
 * @param {string} params.targetUrl - URL to navigate to when clicked
 * @param {Object} params.metadata - Extra data (e.g. postTitle)
 */
export async function dispatchNotification({
  userId,
  actorId,
  type,
  action,
  targetId,
  targetUrl,
  metadata = {}
}) {
  try {
    if (userId === actorId) return; // Don't self-notify
    
    const groupKey = `${type}:${action}:${targetId}`;
    const payload = {
      user_id: userId,
      actor_id: actorId,
      type,
      action,
      group_key: groupKey,
      target_url: targetUrl,
      metadata,
    };

    // If Redis is enabled and we are not in a test environment, push to notification_buffer
    if (redisClient && process.env.NODE_ENV !== 'test') {
      try {
        // 1. Deduplication window of 3 seconds to avoid double-clicking or rapid action spam
        const dedupeKey = RedisKeys.notifDedupe({ userId, actorId, type, action, targetId });
        const isDuplicate = await redisClient.exists(dedupeKey);
        if (isDuplicate) return;
        await redisClient.set(dedupeKey, '1', 'EX', 3);

        // 2. Push to Redis Buffer list
        await redisClient.rpush(RedisKeys.NOTIFICATION_BUFFER, JSON.stringify(payload));
        return;
      } catch (err) {
        console.warn('[NotificationService] Redis buffer failed, falling back to direct queue:', err.message);
      }
    }

    if (!notificationQueue) {
      console.warn('[NotificationService] notificationQueue is not available');
      return;
    }

    // Fallback: Add individual job to BullMQ queue (useful for tests or degraded mode)
    await notificationQueue.add(
      'dispatch',
      payload,
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    );
  } catch (error) {
    console.error('[NotificationService] Error dispatching notification:', error);
  }
}

