import { and, eq, isNull, sql } from 'drizzle-orm';
import db from '../db/db.js';
import { follows, posts, users } from '../db/schemas/index.js';

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

const toCount = (row) => {
  const parsed = Number(row?.count ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUsername = (value = '') => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const buildFallbackProfile = ({ userId, email = null }) => ({
  id: userId,
  email,
  username: null,
  fullName: null,
  avatar: null,
  bio: null,
  createdAt: null,
  updatedAt: null,
  stats: {
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  },
  isFollowing: false,
  isSelf: true,
});

const UsersService = {
  async checkUsernameAvailability({ username, excludeUserId = null }) {
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername) {
      return {
        available: false,
        normalizedUsername,
        reason: 'Username is required.',
      };
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return {
        available: false,
        normalizedUsername,
        reason:
          'Username must be 3-20 characters and can only contain lowercase letters, numbers, dot, or underscore.',
      };
    }

    const [existingUser] = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(sql`lower(${users.username}) = ${normalizedUsername}`)
      .limit(1);

    const isOwnUsername = Boolean(
      existingUser && excludeUserId && existingUser.id === excludeUserId,
    );

    if (existingUser && !isOwnUsername) {
      return {
        available: false,
        normalizedUsername,
        reason: 'Username is already taken.',
      };
    }

    return {
      available: true,
      normalizedUsername,
      reason: null,
    };
  },

  async getProfileById({ targetUserId, viewerUserId = null, fallbackEmail = null }) {
    if (!targetUserId) {
      return null;
    }

    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        bio: users.bio,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!profile) {
      if (viewerUserId && targetUserId === viewerUserId) {
        return buildFallbackProfile({ userId: targetUserId, email: fallbackEmail });
      }

      return null;
    }

    const [followersResult, followingResult, postsResult, followResult] =
      await Promise.all([
        db
          .select({ count: sql`count(*)::int` })
          .from(follows)
          .where(eq(follows.followingId, targetUserId))
          .limit(1),
        db
          .select({ count: sql`count(*)::int` })
          .from(follows)
          .where(eq(follows.followerId, targetUserId))
          .limit(1),
        db
          .select({ count: sql`count(*)::int` })
          .from(posts)
          .where(and(eq(posts.userId, targetUserId), isNull(posts.deletedAt)))
          .limit(1),
        viewerUserId && viewerUserId !== targetUserId
          ? db
              .select({ id: follows.id })
              .from(follows)
              .where(
                and(
                  eq(follows.followerId, viewerUserId),
                  eq(follows.followingId, targetUserId),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ]);

    return {
      ...profile,
      stats: {
        followersCount: toCount(followersResult[0]),
        followingCount: toCount(followingResult[0]),
        postsCount: toCount(postsResult[0]),
      },
      isFollowing: followResult.length > 0,
      isSelf: Boolean(viewerUserId && viewerUserId === targetUserId),
    };
  },

  async getMyProfile({ userId, email = null }) {
    return this.getProfileById({
      targetUserId: userId,
      viewerUserId: userId,
      fallbackEmail: email,
    });
  },

  async followUser({ followerId, followingId }) {
    if (!followerId || !followingId) {
      throw new Error('Missing followerId or followingId.');
    }

    if (followerId === followingId) {
      throw new Error('You cannot follow yourself.');
    }

    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, followingId))
      .limit(1);

    if (!targetUser) {
      throw new Error('User not found.');
    }

    const [existingFollow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)),
      )
      .limit(1);

    if (!existingFollow) {
      await db.insert(follows).values({
        followerId,
        followingId,
      });
    }

    return this.getProfileById({
      targetUserId: followingId,
      viewerUserId: followerId,
    });
  },

  async unfollowUser({ followerId, followingId }) {
    if (!followerId || !followingId) {
      throw new Error('Missing followerId or followingId.');
    }

    if (followerId === followingId) {
      throw new Error('You cannot unfollow yourself.');
    }

    await db
      .delete(follows)
      .where(
        and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)),
      );

    return this.getProfileById({
      targetUserId: followingId,
      viewerUserId: followerId,
    });
  },
};

export default UsersService;
