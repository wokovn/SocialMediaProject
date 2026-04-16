import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import media from '../db/schemas/media.schema.js'
import { eq, and, isNull, desc, inArray, asc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import postsRedis from './posts.redis.js'
import redisService from '../../infra/redis/redis.service.js'
import MediaService from '../media/media.service.js'

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



const PostsService = {

    getPublicFeed: async (userId, limit = 20, offset = 0) => {
        const feed = await db
                            .select({
                                    id: posts.id,
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
                                .where(and(eq(posts.visibility, 'public'), isNull(posts.deletedAt)))
                                .orderBy(desc(posts.createdAt))
                                .limit(limit)
                                .offset(offset);
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

        return withPostMedia(feedWithLikes);
    },

    getPostById: async (postId, userId) => {
        const post = await db
                            .select({
                                    id: posts.id,
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
        if (!post[0]) return null;
        let hasLiked = 0;
        if (userId) {
            try {
                hasLiked = await redisService.sismember(`post:${postId}:likes`, userId);
            } catch (error) {
                console.warn('Redis unavailable in getPostById; defaulting hasLiked=false');
                hasLiked = 0;
            }
        }
        const [postWithMedia] = await withPostMedia([{ ...post[0], hasLiked: hasLiked === 1 }]);
        return postWithMedia;
    },
    getPostsByUserId: async (targetUserId, viewerUserId) => {
         const post = await db
                            .select({
                                    id: posts.id,
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
                                .where(eq(posts.userId, targetUserId));
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

        return withPostMedia(postsWithLikes);
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

        return {
            ...postWithAuthor,
            hasLiked: false,
            media: insertedMediaRows.map((row) => ({
                ...row,
                variants: null,
            })),
        };
    },
    deletePost(postId) {
        return db.update(posts).set({
            deletedAt: new Date(),
        }).where(eq(posts.id, postId));
    },
    likePost({ userId, postId}) {
        return postsRedis.likePost(postId, userId);
    },
    unlikePost({ userId, postId}) {
        return postsRedis.unlikePost(postId, userId);
    }

}
export default PostsService;