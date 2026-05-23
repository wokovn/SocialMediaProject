import { describe, it, expect, vi, beforeEach } from 'vitest';
import postsRedis from '../../../modules/posts/posts.redis.js';
import redisService from '../../../infra/redis/redis.service.js';
import db from '../../../modules/db/db.js';
import { addRankingJobWithThrottle } from '../../../infra/queue/ranking.queue.js';
import { dispatchNotification } from '../../../modules/notifications/notifications.service.js';

vi.mock('../../../infra/redis/redis.service.js', () => ({
  default: {
    pipeline: vi.fn(),
    scard: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../../modules/db/db.js', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../../infra/queue/ranking.queue.js', () => ({
  addRankingJobWithThrottle: vi.fn().mockResolvedValue(),
}));

vi.mock('../../../modules/notifications/notifications.service.js', () => ({
  dispatchNotification: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

describe('postsRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('likes a post via redis pipeline', async () => {
    db.limit.mockResolvedValueOnce([{ userId: 'owner-1', content: 'hello' }]);

    const pipeline = {
      rpush: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      scard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 3],
      ]),
    };
    redisService.pipeline.mockReturnValue(pipeline);

    const result = await postsRedis.likePost('post-1', 'user-2');

    expect(dispatchNotification).toHaveBeenCalled();
    expect(addRankingJobWithThrottle).toHaveBeenCalledWith('post-1', 'LIKE');
    expect(result).toEqual({ success: true, likeCount: 3 });
  });

  it('falls back to db when redis like fails', async () => {
    db.limit
      .mockResolvedValueOnce([{ userId: 'owner-1', content: 'hello' }])
      .mockResolvedValueOnce([{ likesCount: 4 }]);

    redisService.pipeline.mockImplementation(() => {
      throw new Error('redis down');
    });

    const result = await postsRedis.likePost('post-1', 'user-2');

    expect(db.insert).toHaveBeenCalled();
    expect(addRankingJobWithThrottle).toHaveBeenCalledWith('post-1', 'LIKE');
    expect(result).toEqual({ success: true, likeCount: 4 });
  });

  it('falls back to db when redis unlike fails', async () => {
    db.limit.mockResolvedValueOnce([{ likesCount: 2 }]);

    redisService.pipeline.mockImplementation(() => {
      throw new Error('redis down');
    });

    const result = await postsRedis.unlikePost('post-1', 'user-2');

    expect(db.delete).toHaveBeenCalled();
    expect(addRankingJobWithThrottle).toHaveBeenCalledWith('post-1', 'UNLIKE');
    expect(result).toEqual({ success: true, likeCount: 2 });
  });

  it('falls back to db for getLikeCount when redis fails', async () => {
    redisService.scard.mockRejectedValueOnce(new Error('redis down'));
    db.limit.mockResolvedValueOnce([{ likesCount: 9 }]);

    const result = await postsRedis.getLikeCount('post-1');

    expect(result).toBe(9);
  });

  it('parses cached post payloads', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify({ id: 'post-1' }));

    const result = await postsRedis.getPost('post-1');

    expect(result).toEqual({ id: 'post-1' });
  });
});
