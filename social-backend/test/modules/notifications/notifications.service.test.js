import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchNotification } from '../../../modules/notifications/notifications.service.js';

let mockQueue = { add: vi.fn() };

vi.mock('../../../infra/queue/notification.queue.js', () => ({
  get notificationQueue() {
    return mockQueue;
  }
}));

describe('dispatchNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue = { add: vi.fn().mockResolvedValue(true) };
  });

  it('skips when actor and user are the same', async () => {
    await dispatchNotification({
      userId: 'user-1',
      actorId: 'user-1',
      type: 'INTERACTION',
      action: 'LIKE',
      targetId: 'post-1',
      targetUrl: '/post/post-1'
    });

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('warns and skips when queue is unavailable', async () => {
    mockQueue = null;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await dispatchNotification({
      userId: 'user-1',
      actorId: 'user-2',
      type: 'INTERACTION',
      action: 'LIKE',
      targetId: 'post-1',
      targetUrl: '/post/post-1'
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('enqueues a dispatch job with group key', async () => {
    await dispatchNotification({
      userId: 'user-1',
      actorId: 'user-2',
      type: 'INTERACTION',
      action: 'COMMENT',
      targetId: 'post-1',
      targetUrl: '/post/post-1',
      metadata: { postTitle: 'hello' }
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      {
        user_id: 'user-1',
        actor_id: 'user-2',
        type: 'INTERACTION',
        action: 'COMMENT',
        group_key: 'INTERACTION:COMMENT:post-1',
        target_url: '/post/post-1',
        metadata: { postTitle: 'hello' }
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    );
  });

  it('logs error when queue add fails', async () => {
    mockQueue = { add: vi.fn().mockRejectedValue(new Error('queue down')) };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await dispatchNotification({
      userId: 'user-1',
      actorId: 'user-2',
      type: 'INTERACTION',
      action: 'LIKE',
      targetId: 'post-1',
      targetUrl: '/post/post-1',
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
