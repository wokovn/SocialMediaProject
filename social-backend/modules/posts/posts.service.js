import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import { eq, and, isNull, desc } from 'drizzle-orm'
import postsRedis from './posts.redis.js'
import redisService from '../../infra/redis/redis.service.js'



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
        const pipeline = redisService.pipeline();
        feed.forEach(post => pipeline.sismember(`post:${post.id}:likes`, userId));
        const results = await pipeline.exec();
        return feed.map((post, i) => ({ ...post, hasLiked: results[i][1] === 1 }));
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
        const hasLiked = await redisService.sismember(`post:${postId}:likes`, userId);
        return { ...post[0], hasLiked: hasLiked === 1 };
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
        const pipeline = redisService.pipeline();
        post.forEach(p => pipeline.sismember(`post:${p.id}:likes`, viewerUserId));
        const results = await pipeline.exec();
        return post.map((p, i) => ({ ...p, hasLiked: results[i][1] === 1 }));
    },
    createPost({userId, content, visibility}) {
        return db.insert(posts).values({
            userId,
            content,
            visibility,
        }).returning();
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