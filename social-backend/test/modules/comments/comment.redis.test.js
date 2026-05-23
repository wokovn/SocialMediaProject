import { describe, it, expect, vi, beforeEach } from 'vitest';
import commentRedis from '../../../modules/comments/comment.redis.js';
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
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

describe('commentRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns counts from redis pipeline', async () => {
    const pipeline = {
      rpush: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 1],
        [null, 5],
        [null, 2],
      ]),
    };
    redisService.pipeline.mockReturnValue(pipeline);

    const result = await commentRedis.postComment({
      commentId: 'c1',
      userId: 'u1',
      postId: 'p1',
      parentId: 'p0',
      content: 'hello',
    });

    expect(result).toEqual({
      success: true,
      commentCount: 5,
      repliesCount: 2,
    });
  });

  it('falls back to db when redis fails', async () => {
    redisService.pipeline.mockImplementation(() => {
      throw new Error('redis down');
    });
    db.limit.mockResolvedValueOnce([{ commentsCount: 7 }]);

    const result = await commentRedis.postComment({
      commentId: 'c1',
      userId: 'u1',
      postId: 'p1',
      content: 'hello',
    });

    expect(db.insert).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      commentCount: 7,
      repliesCount: null,
    });
  });
});
