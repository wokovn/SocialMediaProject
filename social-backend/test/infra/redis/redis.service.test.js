import { describe, it, expect, vi, beforeEach } from 'vitest';
import redisService from '../../../infra/redis/redis.service.js';
import redis from '../../../infra/redis/redis.config.js';

vi.mock('../../../infra/redis/redis.config.js', () => {
  const mockClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    incrby: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    type: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    sismember: vi.fn(),
    scard: vi.fn(),
    smembers: vi.fn(),
    zadd: vi.fn(),
    zrevrange: vi.fn(),
    zscore: vi.fn(),
    zrem: vi.fn(),
    zremrangebyrank: vi.fn(),
    zcard: vi.fn(),
    rpush: vi.fn(),
    lpush: vi.fn(),
    lpop: vi.fn(),
    rpop: vi.fn(),
    lrange: vi.fn(),
    llen: vi.fn(),
    pipeline: vi.fn(),
  };

  return {
    default: mockClient,
    isRedisEnabled: true,
  };
});

describe('Redis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Strings', () => {
    it('get returns value when successful', async () => {
      redis.get.mockResolvedValueOnce('bar');
      const val = await redisService.get('foo');
      expect(val).toBe('bar');
      expect(redis.get).toHaveBeenCalledWith('foo');
    });

    it('get returns null when key does not exist or throws error', async () => {
      redis.get.mockRejectedValueOnce(new Error('redis down'));
      const val = await redisService.get('foo');
      expect(val).toBeNull();
    });

    it('set supports optional TTL and returns ok', async () => {
      redis.set.mockResolvedValueOnce('OK');
      const res = await redisService.set('foo', 'bar');
      expect(res).toBe('OK');
      expect(redis.set).toHaveBeenCalledWith('foo', 'bar');

      await redisService.set('foo', 'bar', 10);
      expect(redis.set).toHaveBeenLastCalledWith('foo', 'bar', 'EX', 10);
    });

    it('set returns null on error', async () => {
      redis.set.mockRejectedValueOnce(new Error('error'));
      const res = await redisService.set('foo', 'bar');
      expect(res).toBeNull();
    });

    it('del returns deleted count', async () => {
      redis.del.mockResolvedValueOnce(1);
      expect(await redisService.del('foo')).toBe(1);

      redis.del.mockRejectedValueOnce(new Error('error'));
      expect(await redisService.del('foo')).toBe(0);
    });
  });

  describe('Counters', () => {
    it('incr/decr return numeric counts', async () => {
      redis.incr.mockResolvedValueOnce(5);
      expect(await redisService.incr('count')).toBe(5);

      redis.decr.mockResolvedValueOnce(4);
      expect(await redisService.decr('count')).toBe(4);
    });

    it('incr/decr return 0 on error', async () => {
      redis.incr.mockRejectedValueOnce(new Error('error'));
      expect(await redisService.incr('count')).toBe(0);
    });
  });

  describe('Sets', () => {
    it('sadd and srem return changed counts', async () => {
      redis.sadd.mockResolvedValueOnce(1);
      expect(await redisService.sadd('set', 'item')).toBe(1);

      redis.srem.mockResolvedValueOnce(1);
      expect(await redisService.srem('set', 'item')).toBe(1);
    });

    it('smembers returns arrays of members', async () => {
      redis.smembers.mockResolvedValueOnce(['a', 'b']);
      expect(await redisService.smembers('set')).toEqual(['a', 'b']);

      redis.smembers.mockRejectedValueOnce(new Error('error'));
      expect(await redisService.smembers('set')).toEqual([]);
    });
  });

  describe('Sorted Sets', () => {
    it('zadd registers items', async () => {
      redis.zadd.mockResolvedValueOnce(1);
      expect(await redisService.zadd('zset', 10, 'member')).toBe(1);
    });

    it('zrevrange returns values and supports WITHSCORES flag', async () => {
      redis.zrevrange.mockResolvedValueOnce(['member']);
      expect(await redisService.zrevrange('zset', 0, -1)).toEqual(['member']);
      expect(redis.zrevrange).toHaveBeenCalledWith('zset', 0, -1);

      redis.zrevrange.mockResolvedValueOnce(['member', '10']);
      expect(await redisService.zrevrange('zset', 0, -1, true)).toEqual(['member', '10']);
      expect(redis.zrevrange).toHaveBeenLastCalledWith('zset', 0, -1, 'WITHSCORES');
    });
  });

  describe('Lists', () => {
    it('lpush and rpush return list lengths', async () => {
      redis.lpush.mockResolvedValueOnce(2);
      expect(await redisService.lpush('list', 'a')).toBe(2);

      redis.rpush.mockResolvedValueOnce(3);
      expect(await redisService.rpush('list', 'b')).toBe(3);
    });

    it('lpop and rpop pop items', async () => {
      redis.lpop.mockResolvedValueOnce('a');
      expect(await redisService.lpop('list')).toBe('a');
    });
  });
});
