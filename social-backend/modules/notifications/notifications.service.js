import { notificationQueue } from '../../infra/queue/notification.queue.js';

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
    if (!notificationQueue) {
      console.warn('[NotificationService] notificationQueue is not available');
      return;
    }

    const groupKey = `${type}:${action}:${targetId}`;
    
    // Add job to BullMQ queue
    await notificationQueue.add(
      'dispatch',
      {
        user_id: userId,
        actor_id: actorId,
        type,
        action,
        group_key: groupKey,
        target_url: targetUrl,
        metadata,
      },
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
