import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationProcessor } from '../../../../infra/workers/notifications/notification.processor.js';
import { supabase } from '../../../../modules/auth/supabase.js';
import redisClient from '../../../../infra/redis/redis.config.js';
import { getEmitter } from '../../../../infra/websocket/emitter.js';

vi.mock('../../../../modules/auth/supabase.js', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../../../infra/redis/redis.config.js', () => ({
  default: {
    incr: vi.fn(),
    exists: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../../../infra/websocket/emitter.js', () => ({
  getEmitter: vi.fn(),
}));

const mockSupabase = ({ actor, notification, insertError = null }) => {
  const usersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: actor }),
  };

  const notificationsQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: notification, error: insertError }),
  };

  supabase.from.mockImplementation((table) =>
    table === 'users' ? usersQuery : notificationsQuery,
  );

  return { usersQuery, notificationsQuery };
};

describe('notificationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits realtime notifications when user is online', async () => {
    const emitter = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    getEmitter.mockReturnValue(emitter);

    redisClient.incr.mockResolvedValueOnce(1);
    redisClient.exists.mockResolvedValueOnce(1);
    redisClient.get.mockResolvedValueOnce('3');

    mockSupabase({
      actor: { full_name: 'Alice', avatar_url: 'avatar.png' },
      notification: { id: 'notif-1' },
    });

    const result = await notificationProcessor({
      data: {
        user_id: 'user-1',
        actor_id: 'user-2',
        type: 'INTERACTION',
        action: 'LIKE',
        group_key: 'INTERACTION:LIKE:post-1',
        target_url: '/post/post-1',
        metadata: {},
      },
    });

    expect(emitter.emit).toHaveBeenCalledWith('NEW_NOTIFICATION', { id: 'notif-1' });
    expect(emitter.emit).toHaveBeenCalledWith('UNREAD_COUNT', { count: 3 });
    expect(result).toEqual({
      success: true,
      notificationId: 'notif-1',
      deliveredRealtime: true,
    });
  });

  it('returns without realtime emit when user is offline', async () => {
    const emitter = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    getEmitter.mockReturnValue(emitter);

    redisClient.incr.mockResolvedValueOnce(1);
    redisClient.exists.mockResolvedValueOnce(0);

    mockSupabase({
      actor: { full_name: 'Alice', avatar_url: 'avatar.png' },
      notification: { id: 'notif-2' },
    });

    const result = await notificationProcessor({
      data: {
        user_id: 'user-1',
        actor_id: 'user-2',
        type: 'INTERACTION',
        action: 'COMMENT',
        group_key: 'INTERACTION:COMMENT:post-1',
        target_url: '/post/post-1',
        metadata: {},
      },
    });

    expect(emitter.emit).not.toHaveBeenCalled();
    expect(result.deliveredRealtime).toBe(false);
  });

  it('throws when notification insert fails', async () => {
    mockSupabase({
      actor: { full_name: 'Alice', avatar_url: 'avatar.png' },
      notification: null,
      insertError: { message: 'insert failed' },
    });

    await expect(
      notificationProcessor({
        data: {
          user_id: 'user-1',
          actor_id: 'user-2',
          type: 'INTERACTION',
          action: 'LIKE',
          group_key: 'INTERACTION:LIKE:post-1',
          target_url: '/post/post-1',
          metadata: {},
        },
      }),
    ).rejects.toThrow('Failed to insert notification: insert failed');
  });
});
