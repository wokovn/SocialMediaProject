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
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
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

vi.mock('drizzle-orm', () => {
  const mockSqlFn = Object.assign(
    vi.fn(() => ''),
    {
      join: vi.fn(),
    }
  );
  return {
    and: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    isNull: vi.fn(),
    or: vi.fn(),
    sql: mockSqlFn,
  };
});

vi.mock('drizzle-orm/sql', () => {
  const mockSqlFn = Object.assign(
    vi.fn(() => ''),
    {
      join: vi.fn(),
    }
  );
  return {
    sql: mockSqlFn,
  };
});

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

  // --- NEW UNIT TESTS FOR OPTIMIZED INFONITE SCROLL AND PROFILE FEATURES ---

  it('updates own profile info successfully', async () => {
    const profileSpy = vi.spyOn(UsersService, 'getProfileById').mockResolvedValue({
      id: 'u1',
      fullName: 'New Display Name',
      bio: 'New biography description',
      website: 'mywebsite.org',
      showEmail: true,
      isSelf: true,
    });

    const result = await UsersService.updateProfile({
      userId: 'u1',
      fullName: 'New Display Name',
      bio: 'New biography description',
      website: 'mywebsite.org',
      showEmail: true,
    });

    expect(result.fullName).toBe('New Display Name');
    expect(result.bio).toBe('New biography description');
    expect(result.website).toBe('mywebsite.org');
    expect(result.showEmail).toBe(true);

    profileSpy.mockRestore();
  });

  it('updates own cover banner successfully', async () => {
    const profileSpy = vi.spyOn(UsersService, 'getProfileById').mockResolvedValue({
      id: 'u1',
      banner: 'https://supabase.local/media/banner.jpg',
      isSelf: true,
    });

    const result = await UsersService.updateBanner({
      userId: 'u1',
      bannerUrl: 'https://supabase.local/media/banner.jpg',
    });

    expect(result.banner).toBe('https://supabase.local/media/banner.jpg');
    profileSpy.mockRestore();
  });

  it('retrieves followers list of a user', async () => {
    const mockFollowers = [
      { id: 'f1', username: 'follower1', fullName: 'Follower One', followedAt: '2026-05-24T00:00:00Z' },
      { id: 'f2', username: 'follower2', fullName: 'Follower Two', followedAt: '2026-05-23T00:00:00Z' }
    ];
    db.limit.mockResolvedValueOnce(mockFollowers);

    const followers = await UsersService.getFollowers({ targetUserId: 'u1', limit: 20 });
    expect(followers.length).toBe(2);
    expect(followers[0].username).toBe('follower1');
  });

  it('retrieves following list of a user', async () => {
    const mockFollowing = [
      { id: 'g1', username: 'following1', fullName: 'Following One', followedAt: '2026-05-24T00:00:00Z' }
    ];
    db.limit.mockResolvedValueOnce(mockFollowing);

    const following = await UsersService.getFollowing({ targetUserId: 'u1', limit: 20 });
    expect(following.length).toBe(1);
    expect(following[0].username).toBe('following1');
  });

  it('performs full-text search and returns users and posts', async () => {
    const mockUsers = [{ id: 's1', username: 'search_user', fullName: 'Search Result' }];
    // Set limit mock for users
    db.limit.mockResolvedValueOnce(mockUsers);

    const results = await UsersService.search({
      query: 'search',
      filter: 'users',
      limit: 10,
    });

    expect(results.users.length).toBe(1);
    expect(results.users[0].username).toBe('search_user');
  });
});
