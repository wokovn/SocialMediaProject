import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import media from '../db/schemas/media.schema.js'
import follows from '../db/schemas/follows.schema.js'
import bookmarks from '../db/schemas/bookmarks.schema.js'
import { eq, and, isNull, inArray, asc } from 'drizzle-orm'
import redisService from '../../infra/redis/redis.service.js'
import RedisKeys from '../../infra/redis/redis.key.js'
import MediaService from '../media/media.service.js'

// ── Shared post query columns ────
export const postColumns = {
    id: posts.id,
    sharedPostId: posts.sharedPostId,
    content: posts.content,
    visibility: posts.visibility,
    likesCount: posts.likesCount,
    commentsCount: posts.commentsCount,
    sharesCount: posts.sharesCount,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    author: {
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        avatar: users.avatar,
    },
};

export const sanitizeMediaAttachments = (mediaAttachments = []) => {
    if (!Array.isArray(mediaAttachments)) {
        return [];
    }

    const toIntegerOrNull = (value) => {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    };

    return mediaAttachments
        .filter((item) =>
            item &&
            ((typeof item.url === 'string' && item.url.trim().length > 0) ||
              (typeof item.storagePath === 'string' && item.storagePath.trim().length > 0))
        )
        .map((item, index) => ({
            storageBucket:
                typeof item.storageBucket === 'string' && item.storageBucket.trim().length > 0
                    ? item.storageBucket.trim()
                    : null,
            url:
                typeof item.url === 'string' && item.url.trim().length > 0
                    ? item.url.trim()
                    : null,
            storagePath:
                typeof item.storagePath === 'string' && item.storagePath.trim().length > 0
                    ? item.storagePath.trim()
                    : null,
            mediaType:
                item.mediaType === 'image' || item.mediaType === 'video'
                    ? item.mediaType
                    : null,
            fileSize: toIntegerOrNull(item.fileSize),
            width: toIntegerOrNull(item.width),
            height: toIntegerOrNull(item.height),
            duration: toIntegerOrNull(item.duration),
            thumbnailUrl:
                typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.trim()
                    ? item.thumbnailUrl.trim()
                    : null,
            altText:
                typeof item.altText === 'string' && item.altText.trim()
                    ? item.altText.trim().slice(0, 255)
                    : null,
            displayOrder: Number.isInteger(item.displayOrder) ? item.displayOrder : index,
        }));
};

export const withPostMedia = async (postRows = []) => {
    if (!postRows.length) {
        return [];
    }

    const postIds = postRows.map((post) => post.id);
    const mediaRows = await db
        .select({
            id: media.id,
            postId: media.postId,
            url: media.url,
            mediaType: media.mediaType,
            fileSize: media.fileSize,
            width: media.width,
            height: media.height,
            duration: media.duration,
            thumbnailUrl: media.thumbnailUrl,
            altText: media.altText,
            displayOrder: media.displayOrder,
        })
        .from(media)
        .where(inArray(media.postId, postIds))
        .orderBy(asc(media.postId), asc(media.displayOrder), asc(media.createdAt));

    const mediaByPostId = mediaRows.reduce((acc, row) => {
        if (!acc[row.postId]) {
            acc[row.postId] = [];
        }

        const variants =
            row.mediaType === 'image' && row.thumbnailUrl
                ? MediaService.getImageVariantUrls({
                    url: row.url,
                    postId: row.postId,
                    targetKind: 'post',
                })
                : null;

        acc[row.postId].push({
            id: row.id,
            url: row.url,
            mediaType: row.mediaType,
            fileSize: row.fileSize,
            width: row.width,
            height: row.height,
            duration: row.duration,
            thumbnailUrl: row.thumbnailUrl,
            variants,
            altText: row.altText,
            displayOrder: row.displayOrder,
        });

        return acc;
    }, {});

    return postRows.map((post) => ({
        ...post,
        media: mediaByPostId[post.id] || [],
    }));
};

export const isMutualFollowRelationship = async ({ firstUserId, secondUserId }) => {
    if (!firstUserId || !secondUserId) {
        return false;
    }

    if (firstUserId === secondUserId) {
        return true;
    }

    const [firstFollowsSecond, secondFollowsFirst] = await Promise.all([
        db
            .select({ id: follows.id })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, firstUserId),
                    eq(follows.followingId, secondUserId),
                ),
            )
            .limit(1),
        db
            .select({ id: follows.id })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, secondUserId),
                    eq(follows.followingId, firstUserId),
                ),
            )
            .limit(1),
    ]);

    return firstFollowsSecond.length > 0 && secondFollowsFirst.length > 0;
};

export const canViewerAccessPost = async ({ viewerUserId, ownerUserId, visibility }) => {
    if (viewerUserId && ownerUserId && viewerUserId === ownerUserId) {
        return true;
    }

    const resolvedVisibility = visibility || 'public';
    if (resolvedVisibility === 'public') {
        return true;
    }

    if (resolvedVisibility === 'private') {
        return false;
    }

    if (resolvedVisibility === 'friends') {
        return isMutualFollowRelationship({
            firstUserId: viewerUserId,
            secondUserId: ownerUserId,
        });
    }

    return false;
};

export const withPostBookmarks = async ({ postRows = [], userId, forceBookmarked = false }) => {
    if (!postRows.length) {
        return [];
    }

    if (forceBookmarked) {
        return postRows.map((post) => ({ ...post, isBookmarked: true }));
    }

    if (!userId) {
        return postRows.map((post) => ({ ...post, isBookmarked: false }));
    }

    const postIds = postRows.map((post) => post.id);
    const bookmarkedRows = await db
        .select({ postId: bookmarks.postId })
        .from(bookmarks)
        .where(
            and(
                eq(bookmarks.userId, userId),
                inArray(bookmarks.postId, postIds),
            ),
        );

    const bookmarkedPostIds = new Set(bookmarkedRows.map((row) => row.postId));

    return postRows.map((post) => ({
        ...post,
        isBookmarked: bookmarkedPostIds.has(post.id),
    }));
};

export const withSharedPosts = async ({ postRows = [], viewerUserId }) => {
    if (!postRows.length) {
        return [];
    }

    const sharedPostIds = [...new Set(postRows.map((post) => post.sharedPostId).filter(Boolean))];
    if (!sharedPostIds.length) {
        return postRows.map((post) => ({ ...post, sharedPost: null }));
    }

    const sharedPostRows = await db
        .select({
            ...postColumns,
            userId: posts.userId,
        })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .where(and(inArray(posts.id, sharedPostIds), isNull(posts.deletedAt)));

    const accessibleSharedPosts = [];
    for (const sharedPost of sharedPostRows) {
        const canAccessPost = await canViewerAccessPost({
            viewerUserId,
            ownerUserId: sharedPost.userId,
            visibility: sharedPost.visibility,
        });

        if (canAccessPost) {
            accessibleSharedPosts.push(sharedPost);
        }
    }

    if (!accessibleSharedPosts.length) {
        return postRows.map((post) => ({ ...post, sharedPost: null }));
    }

    let sharedPostsWithLikes;
    if (viewerUserId) {
        try {
            const pipeline = redisService.pipeline();
            accessibleSharedPosts.forEach((sharedPost) => {
                pipeline.sismember(RedisKeys.postLikes(sharedPost.id), viewerUserId);
            });
            const results = await pipeline.exec();
            sharedPostsWithLikes = accessibleSharedPosts.map((sharedPost, index) => ({
                ...sharedPost,
                hasLiked: results[index]?.[1] === 1,
            }));
        } catch (error) {
            console.warn('Redis unavailable in withSharedPosts; defaulting hasLiked=false');
            sharedPostsWithLikes = accessibleSharedPosts.map((sharedPost) => ({
                ...sharedPost,
                hasLiked: false,
            }));
        }
    } else {
        sharedPostsWithLikes = accessibleSharedPosts.map((sharedPost) => ({
            ...sharedPost,
            hasLiked: false,
        }));
    }

    const sharedPostsWithBookmarks = await withPostBookmarks({
        postRows: sharedPostsWithLikes,
        userId: viewerUserId,
    });
    const sharedPostsWithMedia = await withPostMedia(sharedPostsWithBookmarks);

    const sharedPostMap = new Map(
        sharedPostsWithMedia.map((sharedPost) => {
            const { userId: _userId, ...sharedPostPayload } = sharedPost;
            return [sharedPost.id, sharedPostPayload];
        }),
    );

    return postRows.map((post) => ({
        ...post,
        sharedPost: post.sharedPostId ? sharedPostMap.get(post.sharedPostId) || null : null,
    }));
};
