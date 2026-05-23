import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../../../modules/notifications/notifications.controller.js';
import { supabase } from '../../../modules/auth/supabase.js';
import redisClient from '../../../infra/redis/redis.config.js';
import RedisKeys from '../../../infra/redis/redis.key.js';

vi.mock('../../../modules/auth/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock('../../../infra/redis/redis.config.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    decr: vi.fn()
  }
}));

const createQuery = (result = {}) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
});

describe('NotificationsController', () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { sub: 'user-1' },
      params: {},
      query: {},
      body: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  it('returns notifications with pagination metadata', async () => {
    const data = [
      { id: 'n1', created_at: '2024-02-02' },
      { id: 'n2', created_at: '2024-02-01' }
    ];
    const query = createQuery({ data, error: null, count: 2 });

    supabase.from.mockReturnValue(query);
    req.query = { limit: '2', cursor: '2024-02-03' };

    await getNotifications(req, res);

    expect(supabase.from).toHaveBeenCalledWith('notifications');
    expect(query.lt).toHaveBeenCalledWith('created_at', '2024-02-03');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data,
      meta: {
        total: 2,
        limit: 2,
        nextCursor: '2024-02-01'
      }
    });
  });

  it('returns 500 when notifications query fails', async () => {
    const query = createQuery({ data: [], error: new Error('db error'), count: 0 });
    supabase.from.mockReturnValue(query);

    await getNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String)
    });
  });

  it('returns unread count from redis when available', async () => {
    redisClient.get.mockResolvedValueOnce('5');

    await getUnreadCount(req, res);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 5 });
  });

  it('falls back to db when redis is empty and updates cache', async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const query = createQuery({ count: 3, error: null });
    supabase.from.mockReturnValue(query);

    await getUnreadCount(req, res);

    expect(redisClient.set).toHaveBeenCalledWith(RedisKeys.notifUnread('user-1'), 3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });

  it('returns 500 when unread count query fails', async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const query = createQuery({ count: 0, error: new Error('db error') });
    supabase.from.mockReturnValue(query);

    await getUnreadCount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String)
    });
  });

  it('marks a notification as read and decrements unread count', async () => {
    req.params = { id: 'notif-1' };
    const query = createQuery({ error: null });
    supabase.from.mockReturnValue(query);
    redisClient.get.mockResolvedValueOnce('2');

    await markAsRead(req, res);

    expect(query.update).toHaveBeenCalledWith({ is_read: true });
    expect(query.eq).toHaveBeenCalledWith('id', 'notif-1');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(redisClient.decr).toHaveBeenCalledWith(RedisKeys.notifUnread('user-1'));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 when markAsRead fails', async () => {
    req.params = { id: 'notif-1' };
    const query = createQuery({ error: new Error('db error') });
    supabase.from.mockReturnValue(query);

    await markAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String)
    });
  });

  it('marks all notifications as read and resets unread count', async () => {
    const query = createQuery({ error: null });
    supabase.from.mockReturnValue(query);

    await markAllAsRead(req, res);

    expect(query.update).toHaveBeenCalledWith({ is_read: true });
    expect(query.eq).toHaveBeenCalledWith('is_read', false);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(redisClient.set).toHaveBeenCalledWith(RedisKeys.notifUnread('user-1'), 0);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 when markAllAsRead fails', async () => {
    const query = createQuery({ error: new Error('db error') });
    supabase.from.mockReturnValue(query);

    await markAllAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String)
    });
  });

  it('soft deletes a notification', async () => {
    req.params = { id: 'notif-1' };
    const query = createQuery({ error: null });
    supabase.from.mockReturnValue(query);

    await deleteNotification(req, res);

    expect(query.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(query.eq).toHaveBeenCalledWith('id', 'notif-1');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 when deleteNotification fails', async () => {
    req.params = { id: 'notif-1' };
    const query = createQuery({ error: new Error('db error') });
    supabase.from.mockReturnValue(query);

    await deleteNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String)
    });
  });
});
