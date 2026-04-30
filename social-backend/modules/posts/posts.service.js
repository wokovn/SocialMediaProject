import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import media from '../db/schemas/media.schema.js'
import follows from '../db/schemas/follows.schema.js'
import bookmarks from '../db/schemas/bookmarks.schema.js'
import { eq, and, isNull, desc, inArray, asc, or, sql, lt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import postsRedis from './posts.redis.js'
import redisService from '../../infra/redis/redis.service.js'
import MediaService from '../media/media.service.js'
import { fanoutQueue } from '../../infra/queue/fanout.queue.js'

const sanitizeMediaAttachments = (mediaAttachments = []) => {
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

const withPostMedia = async (postRows = []) => {
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

const isMutualFollowRelationship = async ({ firstUserId, secondUserId }) => {
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

const canViewerAccessPost = async ({ viewerUserId, ownerUserId, visibility }) => {
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

const withPostBookmarks = async ({ postRows = [], userId, forceBookmarked = false }) => {
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

const withSharedPosts = async ({ postRows = [], viewerUserId }) => {
    if (!postRows.length) {
        return [];
    }

    const sharedPostIds = [...new Set(postRows.map((post) => post.sharedPostId).filter(Boolean))];
    if (!sharedPostIds.length) {
        return postRows.map((post) => ({ ...post, sharedPost: null }));
    }

    const sharedPostRows = await db
        .select({
            id: posts.id,
            userId: posts.userId,
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
                pipeline.sismember(`post:${sharedPost.id}:likes`, viewerUserId);
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



const PostsService = {

    getPublicFeed: async (userId, limit = 20, cursor = null) => {
        const feed = await db
                            .select({
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
                                })
                                .from(posts)
                                .leftJoin(users, eq(posts.userId, users.id))
                                 .where(
                                     and(
                                         eq(posts.visibility, 'public'), 
                                         isNull(posts.deletedAt),
                                         cursor ? lt(posts.createdAt, new Date(cursor)) : undefined
                                     )
                                 )
                                 .orderBy(desc(posts.createdAt))
                                 .limit(limit);
        if (!feed.length) return [];
        let feedWithLikes;

        try {
            const pipeline = redisService.pipeline();
            feed.forEach(post => pipeline.sismember(`post:${post.id}:likes`, userId));
            const results = await pipeline.exec();
            feedWithLikes = feed.map((post, i) => ({ ...post, hasLiked: results[i]?.[1] === 1 }));
        } catch (error) {
            console.warn('Redis unavailable in getPublicFeed; defaulting hasLiked=false');
            feedWithLikes = feed.map((post) => ({ ...post, hasLiked: false }));
        }

        const feedWithBookmarks = await withPostBookmarks({
            postRows: feedWithLikes,
            userId,
        });

        const feedWithMedia = await withPostMedia(feedWithBookmarks);
        return withSharedPosts({ postRows: feedWithMedia, viewerUserId: userId });
    },

    getHybridFeed: async (userId, limit = 20) => {
        // 1. Kéo user_feed (Push Model)
        const userFeedIds = await redisService.lrange(`user_feed:${userId}`, 0, limit - 1);
        
        // 2. Kéo idol_posts (Pull Model)
        const idols = await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
        const idolPostsList = [];
        
        if (idols.length > 0) {
            const pipeline = redisService.pipeline();
            idols.forEach(idol => {
                pipeline.lrange(`idol_posts:${idol.id}`, 0, limit - 1);
            });
            const results = await pipeline.exec();
            results.forEach((res) => {
                if (res[1] && res[1].length > 0) {
                    idolPostsList.push(...res[1]);
                }
            });
        }
        
        // 3. Trộn và lọc trùng
        const mergedIds = [...new Set([...userFeedIds, ...idolPostsList])];
        if (!mergedIds.length) {
            // Fallback to public feed if nothing
            return PostsService.getPublicFeed(userId, limit);
        }
        
        // 4. Lọc Seen Posts (Bloom Filter)
        const unseenIds = [];
        for (const pid of mergedIds) {
            const isSeen = await redisService.sismember(`user:seen:${userId}`, pid);
            if (!isSeen) {
                unseenIds.push(pid);
            }
        }
        
        if (!unseenIds.length) {
             return [];
        }
        
        const idsToFetch = unseenIds.slice(0, limit);
        
        // 5. Fetch bài viết từ DB (đã bảo vệ bằng isNull(deletedAt))
        const rawPosts = await db
            .select({
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
            })
            .from(posts)
            .leftJoin(users, eq(posts.userId, users.id))
            .where(
                and(
                    inArray(posts.id, idsToFetch),
                    isNull(posts.deletedAt)
                )
            )
            .orderBy(desc(posts.createdAt));
            
        // Gắn thêm info
        let postsWithLikes;
        try {
            const pipeline = redisService.pipeline();
            rawPosts.forEach(p => pipeline.sismember(`post:${p.id}:likes`, userId));
            const results = await pipeline.exec();
            postsWithLikes = rawPosts.map((p, i) => ({ ...p, hasLiked: results[i]?.[1] === 1 }));
        } catch (error) {
            postsWithLikes = rawPosts.map((p) => ({ ...p, hasLiked: false }));
        }
        
        const postsWithBookmarks = await withPostBookmarks({ postRows: postsWithLikes, userId });
        const postsWithMedia = await withPostMedia(postsWithBookmarks);
        return withSharedPosts({ postRows: postsWithMedia, viewerUserId: userId });
    },
    
    markSeen: async (userId, postIds) => {
        if (!postIds || !postIds.length) return;
        const pipeline = redisService.pipeline();
        postIds.forEach(id => {
            pipeline.sadd(`user:seen:${userId}`, id);
        });
        // TTL 7 days cho seen list để tránh phình to
        pipeline.expire(`user:seen:${userId}`, 604800);
        await pipeline.exec();
    },

    getSavedPosts: async (userId, limit = 20, cursor = null) => {
        const savedPosts = await db
            .select({
                id: posts.id,
                userId: posts.userId,
                sharedPostId: posts.sharedPostId,
                content: posts.content,
                visibility: posts.visibility,
                likesCount: posts.likesCount,
                commentsCount: posts.commentsCount,
                sharesCount: posts.sharesCount,
                createdAt: posts.createdAt,
                updatedAt: posts.updatedAt,
                savedAt: bookmarks.createdAt,
                author: {
                    id: users.id,
                    fullName: users.fullName,
                    username: users.username,
                    avatar: users.avatar,
                },
            })
            .from(bookmarks)
            .innerJoin(posts, eq(bookmarks.postId, posts.id))
            .leftJoin(users, eq(posts.userId, users.id))
            .where(
                and(
                    eq(bookmarks.userId, userId), 
                    isNull(posts.deletedAt),
                    cursor ? lt(bookmarks.createdAt, new Date(cursor)) : undefined
                )
            )
            .orderBy(desc(bookmarks.createdAt))
            .limit(limit);

        if (!savedPosts.length) {
            return [];
        }

        const accessibleSavedPosts = [];
        for (const post of savedPosts) {
            const canAccess = await canViewerAccessPost({
                viewerUserId: userId,
                ownerUserId: post.userId,
                visibility: post.visibility,
            });

            if (canAccess) {
                accessibleSavedPosts.push(post);
            }
        }

        if (!accessibleSavedPosts.length) {
            return [];
        }

        let postsWithLikes;
        try {
            const pipeline = redisService.pipeline();
            accessibleSavedPosts.forEach((post) =>
                pipeline.sismember(`post:${post.id}:likes`, userId),
            );
            const results = await pipeline.exec();
            postsWithLikes = accessibleSavedPosts.map((post, i) => ({
                ...post,
                hasLiked: results[i]?.[1] === 1,
            }));
        } catch (error) {
            console.warn('Redis unavailable in getSavedPosts; defaulting hasLiked=false');
            postsWithLikes = accessibleSavedPosts.map((post) => ({
                ...post,
                hasLiked: false,
            }));
        }

        const postsWithBookmarks = await withPostBookmarks({
            postRows: postsWithLikes,
            forceBookmarked: true,
        });

        const postsWithMedia = await withPostMedia(postsWithBookmarks);
        const postsWithSharedPosts = await withSharedPosts({
            postRows: postsWithMedia,
            viewerUserId: userId,
        });
        return postsWithSharedPosts.map(({ userId: _userId, ...post }) => post);
    },

    getPostById: async (postId, userId) => {
        const post = await db
                            .select({
                                    id: posts.id,
                        userId: posts.userId,
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
                                })
                                .from(posts)
                                .leftJoin(users, eq(posts.userId, users.id))
                                .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
        if (!post[0]) return null;

        const rawPost = post[0];
        const canAccessPost = await canViewerAccessPost({
            viewerUserId: userId,
            ownerUserId: rawPost.userId,
            visibility: rawPost.visibility,
        });

        if (!canAccessPost) {
            return null;
        }

        let hasLiked = 0;
        if (userId) {
            try {
                hasLiked = await redisService.sismember(`post:${postId}:likes`, userId);
            } catch (error) {
                console.warn('Redis unavailable in getPostById; defaulting hasLiked=false');
                hasLiked = 0;
            }
        }
        let isBookmarked = false;
        if (userId) {
            const [bookmarkRecord] = await db
                .select({ id: bookmarks.id })
                .from(bookmarks)
                .where(
                    and(
                        eq(bookmarks.userId, userId),
                        eq(bookmarks.postId, postId),
                    ),
                )
                .limit(1);

            isBookmarked = Boolean(bookmarkRecord);
        }

        const [postWithMedia] = await withPostMedia([
            {
                ...rawPost,
                hasLiked: hasLiked === 1,
                isBookmarked,
            },
        ]);
        const [postWithSharedPost] = await withSharedPosts({
            postRows: [postWithMedia],
            viewerUserId: userId,
        });
        const { userId: _userId, ...postPayload } = postWithSharedPost;
        return postPayload;
    },
    getPostsByUserId: async (targetUserId, viewerUserId, limit = 20, cursor = null) => {
        const isOwner = targetUserId === viewerUserId;
        const canAccessFriendsPosts = isOwner
            ? true
            : await isMutualFollowRelationship({
                firstUserId: viewerUserId,
                secondUserId: targetUserId,
            });

        const visibilityCondition = isOwner
            ? undefined
            : canAccessFriendsPosts
                ? or(eq(posts.visibility, 'public'), eq(posts.visibility, 'friends'), isNull(posts.visibility))
                : or(eq(posts.visibility, 'public'), isNull(posts.visibility));

         const post = await db
                            .select({
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
                                })
                                .from(posts)
                                .leftJoin(users, eq(posts.userId, users.id))
                                .where(
                                    and(
                                        eq(posts.userId, targetUserId),
                                        isNull(posts.deletedAt),
                                        ...(visibilityCondition ? [visibilityCondition] : []),
                                        cursor ? lt(posts.createdAt, new Date(cursor)) : undefined
                                    ),
                                )
                                .orderBy(desc(posts.createdAt))
                                .limit(limit);
        if (!post.length) return [];
        let postsWithLikes;

        try {
            const pipeline = redisService.pipeline();
            post.forEach(p => pipeline.sismember(`post:${p.id}:likes`, viewerUserId));
            const results = await pipeline.exec();
            postsWithLikes = post.map((p, i) => ({ ...p, hasLiked: results[i]?.[1] === 1 }));
        } catch (error) {
            console.warn('Redis unavailable in getPostsByUserId; defaulting hasLiked=false');
            postsWithLikes = post.map((p) => ({ ...p, hasLiked: false }));
        }

        const postsWithBookmarks = await withPostBookmarks({
            postRows: postsWithLikes,
            userId: viewerUserId,
        });

        const postsWithMedia = await withPostMedia(postsWithBookmarks);
        return withSharedPosts({ postRows: postsWithMedia, viewerUserId });
    },
    async createPost({userId, content, visibility, mediaAttachments = []}) {
        const normalizedMedia = sanitizeMediaAttachments(mediaAttachments);
        const safeContent = typeof content === 'string' ? content : '';
        const postId = randomUUID();

        if (!safeContent.trim() && normalizedMedia.length === 0) {
            throw new Error('Post content or media is required');
        }

        const finalizedMedia = normalizedMedia.length
            ? await MediaService.finalizePostMediaAttachments({
                userId,
                postId,
                mediaAttachments: normalizedMedia,
            })
            : [];

        const { postWithAuthor, insertedMediaRows } = await db.transaction(async (tx) => {
            await tx.insert(posts).values({
                id: postId,
                userId,
                content: safeContent,
                visibility: visibility || 'public',
            });

            let insertedMediaRows = [];

            if (finalizedMedia.length > 0) {
                insertedMediaRows = await tx
                    .insert(media)
                    .values(
                    finalizedMedia.map((item, index) => ({
                        postId,
                        url: item.url,
                        mediaType: item.mediaType,
                        fileSize: item.fileSize,
                        width: item.width,
                        height: item.height,
                        duration: item.duration,
                        thumbnailUrl: item.thumbnailUrl,
                        altText: item.altText,
                        displayOrder: Number.isInteger(item.displayOrder) ? item.displayOrder : index,
                    }))
                )
                    .returning({
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
                    });
            }

            const [postWithAuthor] = await tx
                .select({
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
                })
                .from(posts)
                .leftJoin(users, eq(posts.userId, users.id))
                .where(eq(posts.id, postId));

            return {
                postWithAuthor,
                insertedMediaRows,
            };
        });

        if (insertedMediaRows.length > 0) {
            const finalizedByKey = new Map(
                finalizedMedia.map((item) => [`${item.displayOrder}:${item.url}`, item]),
            );

            const mediaRowsForQueue = insertedMediaRows.map((row, index) => {
                const matched =
                    finalizedByKey.get(`${row.displayOrder}:${row.url}`) ||
                    finalizedMedia[index] ||
                    null;

                return {
                    ...row,
                    storageBucket: matched?.storageBucket || null,
                    storagePath: matched?.storagePath || null,
                    userId,
                    postId,
                };
            });

            MediaService.enqueuePostMediaResizeJobs(mediaRowsForQueue).catch((error) => {
                console.warn('[media] Failed to enqueue resize jobs:', error.message);
            });
        }
        
        // Gọi Fanout Queue để phân phối bài viết vào feed
        fanoutQueue.add('fanout', { postId, userId }).catch((error) => {
            console.error('Failed to enqueue fanout task', error);
        });

        return {
            ...postWithAuthor,
            hasLiked: false,
            isBookmarked: false,
            sharedPost: null,
            media: insertedMediaRows.map((row) => ({
                ...row,
                variants: null,
            })),
        };
    },
    async deletePost(postId) {
        const [targetPost] = await db
            .select({
                id: posts.id,
                sharedPostId: posts.sharedPostId,
                deletedAt: posts.deletedAt,
            })
            .from(posts)
            .where(eq(posts.id, postId))
            .limit(1);

        if (!targetPost || targetPost.deletedAt) {
            return;
        }

        await db.transaction(async (tx) => {
            await tx
                .update(posts)
                .set({ deletedAt: new Date() })
                .where(eq(posts.id, postId));

            if (targetPost.sharedPostId) {
                await tx
                    .update(posts)
                    .set({ sharesCount: sql`GREATEST(${posts.sharesCount} - 1, 0)` })
                    .where(eq(posts.id, targetPost.sharedPostId));
            }
        });
    },
    likePost({ userId, postId}) {
        return postsRedis.likePost(postId, userId);
    },
    unlikePost({ userId, postId}) {
        return postsRedis.unlikePost(postId, userId);
    },
    async sharePost({ userId, postId, content = '' }) {
        const [post] = await db
            .select({
                id: posts.id,
                userId: posts.userId,
                visibility: posts.visibility,
            })
            .from(posts)
            .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
            .limit(1)

        if (!post) {
            throw new Error('Post not found')
        }

        const canAccessPost = await canViewerAccessPost({
            viewerUserId: userId,
            ownerUserId: post.userId,
            visibility: post.visibility,
        })

        if (!canAccessPost) {
            throw new Error('Post not found')
        }

        const sharePostId = randomUUID();
        const shareContent = typeof content === 'string' ? content : '';

        const [updatedSourcePost] = await db.transaction(async (tx) => {
            await tx.insert(posts).values({
                id: sharePostId,
                userId,
                sharedPostId: postId,
                content: shareContent,
                visibility: 'public',
            });

            const [updatedPost] = await tx
                .update(posts)
                .set({ sharesCount: sql`${posts.sharesCount} + 1` })
                .where(eq(posts.id, postId))
                .returning({
                    sharesCount: posts.sharesCount,
                });

            return [updatedPost];
        });

        const sharedPost = await PostsService.getPostById(sharePostId, userId);
        if (!sharedPost) {
            throw new Error('Failed to create shared post');
        }

        return {
            success: true,
            post: sharedPost,
            shareCount: Number(updatedSourcePost?.sharesCount || 0),
        };
    },
    async bookmarkPost({ userId, postId }) {
        const [post] = await db
            .select({
                id: posts.id,
                userId: posts.userId,
                visibility: posts.visibility,
            })
            .from(posts)
            .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
            .limit(1);

        if (!post) {
            throw new Error('Post not found');
        }

        const canAccessPost = await canViewerAccessPost({
            viewerUserId: userId,
            ownerUserId: post.userId,
            visibility: post.visibility,
        });

        if (!canAccessPost) {
            throw new Error('Post not found');
        }

        await db
            .insert(bookmarks)
            .values({ userId, postId })
            .onConflictDoNothing();

        return { success: true, isBookmarked: true };
    },
    async unbookmarkPost({ userId, postId }) {
        await db
            .delete(bookmarks)
            .where(
                and(
                    eq(bookmarks.userId, userId),
                    eq(bookmarks.postId, postId),
                ),
            );

        return { success: true, isBookmarked: false };
    }

}
export default PostsService;