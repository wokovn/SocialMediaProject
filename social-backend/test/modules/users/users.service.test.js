import { describe, it, expect, vi, beforeEach } from 'vitest';
import UsersService from '../../../modules/users/users.service.js';
import db from '../../../modules/db/db.js';
import usersRedis from '../../../modules/users/users.redis.js';
import { dispatchNotification } from '../../../modules/notifications/notifications.service.js';

vi.mock('../../../modules/db/db.js', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../modules/users/users.redis.js', () => ({
  default: {
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

vi.mock('../../../modules/notifications/notifications.service.js', () => ({
  dispatchNotification: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when follow relationship is missing ids', async () => {
    await expect(
      UsersService.getFollowRelationship({ viewerUserId: null, targetUserId: 'u1' })
    ).rejects.toThrow('Missing viewerUserId or targetUserId.');
  });

  it('returns neutral relationship for self', async () => {
    const result = await UsersService.getFollowRelationship({
      viewerUserId: 'u1',
      targetUserId: 'u1',
    });

    expect(result).toEqual({
      targetUserId: 'u1',
      viewerUserId: 'u1',
      isFollowing: false,
      isFollowedBy: false,
      isFriend: false,
    });
  });

  it('rejects invalid usernames', async () => {
    const result = await UsersService.checkUsernameAvailability({ username: 'ab' });

    expect(result.available).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects taken usernames', async () => {
    db.limit.mockResolvedValueOnce([{ id: 'u1', username: 'taken' }]);

    const result = await UsersService.checkUsernameAvailability({ username: 'taken' });

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Username is already taken.');
  });

  it('returns fallback profile for missing self profile', async () => {
    db.limit.mockResolvedValueOnce([]);

    const profile = await UsersService.getProfileById({
      targetUserId: 'u1',
      viewerUserId: 'u1',
      fallbackEmail: 'user@example.com',
    });

    expect(profile.email).toBe('user@example.com');
    expect(profile.isSelf).toBe(true);
    expect(profile.stats.followersCount).toBe(0);
  });

  it('dispatches follow notification when a new follow is created', async () => {
    db.limit.mockResolvedValueOnce([{ id: 'u2' }]);
    usersRedis.followUser.mockResolvedValueOnce({ success: true, didChange: true });

    const profileSpy = vi.spyOn(UsersService, 'getProfileById').mockResolvedValue({
      id: 'u2',
      stats: { followersCount: 1, followingCount: 0, postsCount: 0 },
      isFollowing: false,
      isFollowedBy: false,
      isFriend: false,
      isSelf: false,
    });

    const result = await UsersService.followUser({ followerId: 'u1', followingId: 'u2' });

    expect(dispatchNotification).toHaveBeenCalled();
    expect(result.isFollowing).toBe(true);
    expect(result.stats.followersCount).toBe(2);

    profileSpy.mockRestore();
  });

  it('unfollows and updates follower count', async () => {
    usersRedis.unfollowUser.mockResolvedValueOnce({ success: true, didChange: true });

    const profileSpy = vi.spyOn(UsersService, 'getProfileById').mockResolvedValue({
      id: 'u2',
      stats: { followersCount: 3, followingCount: 0, postsCount: 0 },
      isFollowing: true,
      isFollowedBy: false,
      isFriend: false,
      isSelf: false,
    });

    const result = await UsersService.unfollowUser({ followerId: 'u1', followingId: 'u2' });

    expect(result.isFollowing).toBe(false);
    expect(result.stats.followersCount).toBe(2);

    profileSpy.mockRestore();
  });
});
