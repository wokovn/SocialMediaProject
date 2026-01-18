import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import { eq } from 'drizzle-orm'



const PostsService = {

    getPostById: async (postId) => {
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
        return post[0] ?? null;
    },
    getPostsByUserId: async (userId) => {
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
                                .where(eq(posts.userId, userId));
        return post ?? [];
    },

}
export default PostsService;