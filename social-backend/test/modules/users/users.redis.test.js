import { describe, it, expect, vi, beforeEach } from 'vitest';
import usersRedis from '../../../modules/users/users.redis.js';
import redisService from '../../../infra/redis/redis.service.js';
import db from '../../../modules/db/db.js';

vi.mock('../../../infra/redis/redis.service.js', () => ({
  default: {
    pipeline: vi.fn(),
  },
}));

vi.mock('../../../modules/db/db.js', () => ({
  default: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

describe('usersRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follows a user via redis pipeline', async () => {
    const pipeline = {
      rpush: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      scard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 1],
        [null, 5],
        [null, 6],
      ]),
    };
    redisService.pipeline.mockReturnValue(pipeline);

    const result = await usersRedis.followUser({
      followerId: 'user-1',
      followingId: 'user-2',
    });

    expect(result).toEqual({
      success: true,
      didChange: true,
      followingCount: 5,
      followersCount: 6,
    });
  });

  it('falls back to db on follow when redis fails', async () => {
    redisService.pipeline.mockImplementation(() => {
      throw new Error('redis down');
    });
    db.returning.mockResolvedValueOnce([{ id: 'follow-1' }]);

    const result = await usersRedis.followUser({
      followerId: 'user-1',
      followingId: 'user-2',
    });

    expect(db.insert).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      didChange: true,
      followingCount: 0,
      followersCount: 0,
    });
  });

  it('falls back to db on unfollow when redis fails', async () => {
    redisService.pipeline.mockImplementation(() => {
      throw new Error('redis down');
    });

    const result = await usersRedis.unfollowUser({
      followerId: 'user-1',
      followingId: 'user-2',
    });

    expect(db.delete).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      didChange: true,
      followingCount: 0,
      followersCount: 0,
    });
  });
});
