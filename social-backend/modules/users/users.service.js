import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import db from '../db/db.js';
import { follows, posts, users } from '../db/schemas/index.js';
import usersRedis from './users.redis.js';
import { dispatchNotification } from '../notifications/notifications.service.js';

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
  banner: null,
  bio: null,
  website: null,
  showEmail: false,
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
  async getFollowRelationship({ viewerUserId, targetUserId }) {
    if (!viewerUserId || !targetUserId) {
      throw new Error('Missing viewerUserId or targetUserId.');
    }

    if (viewerUserId === targetUserId) {
      return {
        targetUserId,
        viewerUserId,
        isFollowing: false,
        isFollowedBy: false,
        isFriend: false,
      };
    }

    const [followingResult, followedByResult] = await Promise.all([
      db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerUserId),
            eq(follows.followingId, targetUserId),
          ),
        )
        .limit(1),
      db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, targetUserId),
            eq(follows.followingId, viewerUserId),
          ),
        )
        .limit(1),
    ]);

    const isFollowing = followingResult.length > 0;
    const isFollowedBy = followedByResult.length > 0;

    return {
      targetUserId,
      viewerUserId,
      isFollowing,
      isFollowedBy,
      isFriend: isFollowing && isFollowedBy,
    };
  },

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
        banner: users.banner,
        bio: users.bio,
        website: users.website,
        showEmail: users.showEmail,
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

    const [followersResult, followingResult, postsResult, relationship] =
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
          ? this.getFollowRelationship({ viewerUserId, targetUserId })
          : Promise.resolve({
              targetUserId,
              viewerUserId,
              isFollowing: false,
              isFollowedBy: false,
              isFriend: false,
            }),
      ]);

    const isSelf = Boolean(viewerUserId && viewerUserId === targetUserId);

    return {
      ...profile,
      // Hide email from others if showEmail is false
      email: isSelf || profile.showEmail ? profile.email : null,
      stats: {
        followersCount: toCount(followersResult[0]),
        followingCount: toCount(followingResult[0]),
        postsCount: toCount(postsResult[0]),
      },
      isFollowing: relationship.isFollowing,
      isFollowedBy: relationship.isFollowedBy,
      isFriend: relationship.isFriend,
      isSelf,
    };
  },

  async getProfileByUsername({ username, viewerUserId = null }) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return null;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${normalizedUsername}`)
      .limit(1);

    if (!user) return null;

    return this.getProfileById({ targetUserId: user.id, viewerUserId });
  },

  async getMyProfile({ userId, email = null }) {
    return this.getProfileById({
      targetUserId: userId,
      viewerUserId: userId,
      fallbackEmail: email,
    });
  },

  // Update profile fields (bio, fullName, username, website, showEmail)
  async updateProfile({ userId, fullName, username, bio, website, showEmail }) {
    if (!userId) throw new Error('Missing userId.');

    // Validate username if provided
    if (username !== undefined) {
      const { available, reason } = await this.checkUsernameAvailability({
        username,
        excludeUserId: userId,
      });
      if (!available) throw new Error(reason);
    }

    const updatePayload = { updatedAt: new Date() };
    if (fullName !== undefined) updatePayload.fullName = typeof fullName === 'string' ? fullName.trim().slice(0, 100) : null;
    if (username !== undefined) updatePayload.username = normalizeUsername(username) || null;
    if (bio !== undefined) updatePayload.bio = typeof bio === 'string' ? bio.trim().slice(0, 300) : null;
    if (website !== undefined) updatePayload.website = typeof website === 'string' ? website.trim().slice(0, 200) : null;
    if (showEmail !== undefined) updatePayload.showEmail = Boolean(showEmail);

    await db.update(users).set(updatePayload).where(eq(users.id, userId));
    return this.getProfileById({ targetUserId: userId, viewerUserId: userId });
  },

  // Update banner URL after upload finalization
  async updateBanner({ userId, bannerUrl }) {
    if (!userId) throw new Error('Missing userId.');
    await db.update(users).set({ banner: bannerUrl, updatedAt: new Date() }).where(eq(users.id, userId));
    return this.getProfileById({ targetUserId: userId, viewerUserId: userId });
  },

  // Get followers list (paginated)
  async getFollowers({ targetUserId, viewerUserId, limit = 20, cursor = null }) {
    if (!targetUserId) throw new Error('Missing targetUserId.');

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        bio: users.bio,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(
        and(
          eq(follows.followingId, targetUserId),
          cursor ? sql`${follows.createdAt} < ${new Date(cursor)}` : undefined,
        )
      )
      .orderBy(sql`${follows.createdAt} DESC`)
      .limit(limit);

    if (!rows.length) return [];

    // Check if viewer follows each user
    if (viewerUserId) {
      const followerIds = rows.map(r => r.id);
      const viewerFollows = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerUserId),
            sql`${follows.followingId} = ANY(ARRAY[${sql.join(followerIds.map(id => sql`${id}::uuid`), sql`, `)}])`
          )
        );
      const viewerFollowSet = new Set(viewerFollows.map(f => f.followingId));
      return rows.map(r => ({
        ...r,
        isFollowing: viewerFollowSet.has(r.id),
        isSelf: r.id === viewerUserId,
      }));
    }

    return rows.map(r => ({ ...r, isFollowing: false, isSelf: false }));
  },

  // Get following list (paginated)
  async getFollowing({ targetUserId, viewerUserId, limit = 20, cursor = null }) {
    if (!targetUserId) throw new Error('Missing targetUserId.');

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        bio: users.bio,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(
        and(
          eq(follows.followerId, targetUserId),
          cursor ? sql`${follows.createdAt} < ${new Date(cursor)}` : undefined,
        )
      )
      .orderBy(sql`${follows.createdAt} DESC`)
      .limit(limit);

    if (!rows.length) return [];

    if (viewerUserId) {
      const followingIds = rows.map(r => r.id);
      const viewerFollows = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerUserId),
            sql`${follows.followingId} = ANY(ARRAY[${sql.join(followingIds.map(id => sql`${id}::uuid`), sql`, `)}])`
          )
        );
      const viewerFollowSet = new Set(viewerFollows.map(f => f.followingId));
      return rows.map(r => ({
        ...r,
        isFollowing: viewerFollowSet.has(r.id),
        isSelf: r.id === viewerUserId,
      }));
    }

    return rows.map(r => ({ ...r, isFollowing: false, isSelf: false }));
  },

  // Full-text search for users and posts
  async search({ query, filter = 'all', limit = 20, viewerUserId }) {
    if (!query || typeof query !== 'string') return { users: [], posts: [] };

    const rawQuery = query.trim();
    if (!rawQuery) return { users: [], posts: [] };

    // Detect @mention — prioritize user search
    const mentionMatch = rawQuery.match(/^@(\S+)/);
    const isUserQuery = Boolean(mentionMatch);
    const searchTerm = mentionMatch ? mentionMatch[1] : rawQuery;
    const resolvedFilter = isUserQuery ? 'users' : filter;

    const results = { users: [], posts: [] };

    // ── Search Users ──
    if (resolvedFilter === 'all' || resolvedFilter === 'users') {
      const userRows = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatar: users.avatar,
          bio: users.bio,
        })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            or(
              ilike(users.username, `%${searchTerm}%`),
              ilike(users.fullName, `%${searchTerm}%`),
            )
          )
        )
        .orderBy(
          // Exact username match first
          sql`CASE WHEN lower(${users.username}) = ${searchTerm.toLowerCase()} THEN 0 ELSE 1 END`,
          // Then prefix match
          sql`CASE WHEN lower(${users.username}) LIKE ${searchTerm.toLowerCase() + '%'} THEN 0 ELSE 1 END`,
        )
        .limit(limit);

      // Attach isFollowing for each result
      if (viewerUserId && userRows.length) {
        const userIds = userRows.map(u => u.id);
        const viewerFollows = await db
          .select({ followingId: follows.followingId })
          .from(follows)
          .where(
            and(
              eq(follows.followerId, viewerUserId),
              sql`${follows.followingId} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}::uuid`), sql`, `)}])`
            )
          );
        const followSet = new Set(viewerFollows.map(f => f.followingId));
        results.users = userRows.map(u => ({
          ...u,
          isFollowing: followSet.has(u.id),
          isSelf: u.id === viewerUserId,
        }));
      } else {
        results.users = userRows.map(u => ({ ...u, isFollowing: false, isSelf: false }));
      }
    }

    // ── Search Posts ── (only if not exclusively user query)
    if (!isUserQuery && (resolvedFilter === 'all' || resolvedFilter === 'posts')) {
      const postRows = await db
        .select({
          id: posts.id,
          content: posts.content,
          likesCount: posts.likesCount,
          commentsCount: posts.commentsCount,
          sharesCount: posts.sharesCount,
          createdAt: posts.createdAt,
          visibility: posts.visibility,
          author: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatar: users.avatar,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(
          and(
            isNull(posts.deletedAt),
            eq(posts.visibility, 'public'),
            sql`to_tsvector('simple', coalesce(${posts.content}, '')) @@ plainto_tsquery('simple', ${rawQuery})`
          )
        )
        .orderBy(sql`${posts.createdAt} DESC`)
        .limit(limit);

      results.posts = postRows;
    }

    return results;
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

    const writeResult = await usersRedis.followUser({
      followerId,
      followingId,
    });

    const profile = await this.getProfileById({
      targetUserId: followingId,
      viewerUserId: followerId,
    });

    if (!profile) {
      throw new Error('User not found.');
    }

    if (writeResult.didChange && !profile.isFollowing) {
      dispatchNotification({
          userId: followingId,
          actorId: followerId,
          type: 'SOCIAL',
          action: 'FOLLOW',
          targetId: followerId,
          targetUrl: `/`,
          metadata: {}
      });
    }

    const followersCount =
      writeResult.didChange && !profile.isFollowing
        ? profile.stats.followersCount + 1
        : profile.stats.followersCount;

    return {
      ...profile,
      stats: {
        ...profile.stats,
        followersCount,
      },
      isFollowing: true,
      isFriend: Boolean(profile.isFollowedBy),
    };
  },

  async unfollowUser({ followerId, followingId }) {
    if (!followerId || !followingId) {
      throw new Error('Missing followerId or followingId.');
    }

    if (followerId === followingId) {
      throw new Error('You cannot unfollow yourself.');
    }

    await usersRedis.unfollowUser({
      followerId,
      followingId,
    });

    const profile = await this.getProfileById({
      targetUserId: followingId,
      viewerUserId: followerId,
    });

    if (!profile) {
      throw new Error('User not found.');
    }

    const followersCount = profile.isFollowing
      ? Math.max(0, profile.stats.followersCount - 1)
      : profile.stats.followersCount;

    return {
      ...profile,
      stats: {
        ...profile.stats,
        followersCount,
      },
      isFollowing: false,
      isFriend: false,
    };
  },
};

export default UsersService;
