import db from '../db/db.js'
import posts from '../db/schemas/posts.schema.js'
import users from '../db/schemas/users.schema.js'
import likes from '../db/schemas/likes.schema.js'
import comments from '../db/schemas/comments.schema.js'
import { eq, and, isNull, desc, lt, inArray, sql } from 'drizzle-orm'

// Comment service - handles comment-related operations
const CommentService = {
    postComment: async (userId, postId, content, parentId = null) => {
        try {
            await db
                .insert(comments)
                .values({ userId, postId, content, parentId });

            // The DB triggers handle commentsCount and repliesCount automatically.
            // Fetch the inserted comment with author info to return to the client.
            const [newComment] = await db
                .select({
                    id: comments.id,
                    content: comments.content,
                    parentId: comments.parentId,
                    likesCount: comments.likesCount,
                    repliesCount: comments.repliesCount,
                    createdAt: comments.createdAt,
                    author: {
                        id: users.id,
                        fullName: users.fullName,
                        username: users.username,
                        avatar: users.avatar,
                    },
                })
                .from(comments)
                .leftJoin(users, eq(comments.userId, users.id))
                .where(and(eq(comments.userId, userId), eq(comments.postId, postId)))
                .orderBy(desc(comments.createdAt))
                .limit(1);

            return { success: true, comment: { ...newComment, hasLiked: false } };
        } catch (error) {
            console.error('Error posting comment:', error);
            return { success: false, message: 'Failed to post comment' };
        }   
    },
    getPostComments: async (postId, userId, limit = 20, cursor = null) => {
        try {
            // Only fetch top-level comments (no parentId)
            const conditions = [eq(comments.postId, postId), isNull(comments.parentId), isNull(comments.deletedAt)];
            if (cursor) conditions.push(lt(comments.createdAt, new Date(cursor)));

            const commentsList = await db
                .select({
                    id: comments.id,
                    content: comments.content,
                    parentId: comments.parentId,
                    likesCount: comments.likesCount,
                    repliesCount: comments.repliesCount,
                    createdAt: comments.createdAt,
                    author: {
                        id: users.id,
                        fullName: users.fullName,
                        username: users.username,
                        avatar: users.avatar,
                    },
                })
                .from(comments)
                .leftJoin(users, eq(comments.userId, users.id))
                .where(and(...conditions))
                .orderBy(desc(comments.createdAt))
                .limit(limit + 1);

            const hasMore = commentsList.length > limit;
            const page = hasMore ? commentsList.slice(0, limit) : commentsList;

            // Batch check hasLiked from DB
            let likedSet = new Set();
            if (userId && page.length > 0) {
                const commentIds = page.map(c => c.id);
                const userLikes = await db
                    .select({ commentId: likes.commentId })
                    .from(likes)
                    .where(and(eq(likes.userId, userId), inArray(likes.commentId, commentIds)));
                likedSet = new Set(userLikes.map(l => l.commentId));
            }

            return {
                success: true,
                comments: page.map(c => ({ ...c, hasLiked: likedSet.has(c.id) })),
                hasMore,
                nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
            };
        } catch (error) {
            console.error('Error fetching comments:', error);
            return { success: false, message: 'Failed to fetch comments' };
        }
    },

    getReplies: async (commentId, userId) => {
        try {
            const replies = await db
                .select({
                    id: comments.id,
                    content: comments.content,
                    parentId: comments.parentId,
                    likesCount: comments.likesCount,
                    repliesCount: comments.repliesCount,
                    createdAt: comments.createdAt,
                    author: {
                        id: users.id,
                        fullName: users.fullName,
                        username: users.username,
                        avatar: users.avatar,
                    },
                })
                .from(comments)
                .leftJoin(users, eq(comments.userId, users.id))
                .where(and(eq(comments.parentId, commentId), isNull(comments.deletedAt)))
                .orderBy(comments.createdAt);

            let likedSet = new Set();
            if (userId && replies.length > 0) {
                const ids = replies.map(r => r.id);
                const userLikes = await db
                    .select({ commentId: likes.commentId })
                    .from(likes)
                    .where(and(eq(likes.userId, userId), inArray(likes.commentId, ids)));
                likedSet = new Set(userLikes.map(l => l.commentId));
            }

            return {
                success: true,
                replies: replies.map(r => ({ ...r, hasLiked: likedSet.has(r.id) })),
            };
        } catch (error) {
            console.error('Error fetching replies:', error);
            return { success: false, message: 'Failed to fetch replies' };
        }
    },

    likeComment: async (commentId, userId) => {
        try {
            const existingLike = await db
                .select()
                .from(likes)
                .where(and(eq(likes.commentId, commentId), eq(likes.userId, userId)));
            if (existingLike.length > 0) {
                return { success: false, message: 'Already liked' };
            }
            await db.insert(likes).values({ userId, commentId });
            return { success: true };
        } catch (error) {
            console.error('Error liking comment:', error);
            return { success: false, message: 'Failed to like comment' };
        }
    },

    unlikeComment: async (commentId, userId) => {
        try {
            const existingLike = await db
                .select()
                .from(likes)
                .where(and(eq(likes.commentId, commentId), eq(likes.userId, userId)));
            if (existingLike.length === 0) {
                return { success: false, message: 'Not liked yet' };
            }
            await db.delete(likes).where(and(eq(likes.commentId, commentId), eq(likes.userId, userId)));
            return { success: true };
        } catch (error) {
            console.error('Error unliking comment:', error);
            return { success: false, message: 'Failed to unlike comment' };
        }
    },

    deleteComment: async (commentId, userId) => {
        try {
            const comment = await db.select().from(comments).where(eq(comments.id, commentId));
            if (!comment[0]) return { success: false, message: 'Comment not found' };
            if (comment[0].userId !== userId) return { success: false, message: 'Unauthorized' };

            const isTopLevel = !comment[0].parentId;
            const repliesCount = comment[0].repliesCount || 0;

            // Soft-delete the comment
            await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));

            // Cascade soft-delete all replies for top-level comments
            if (isTopLevel && repliesCount > 0) {
                await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.parentId, commentId));
            }

            // Decrement post commentsCount: comment itself + any replies it had
            const totalDecrement = isTopLevel ? 1 + repliesCount : 1;
            await db
                .update(posts)
                .set({ commentsCount: sql`GREATEST(${posts.commentsCount} - ${totalDecrement}, 0)` })
                .where(eq(posts.id, comment[0].postId));

            // If it was a reply, decrement parent repliesCount
            if (!isTopLevel) {
                await db
                    .update(comments)
                    .set({ repliesCount: sql`GREATEST(${comments.repliesCount} - 1, 0)` })
                    .where(eq(comments.id, comment[0].parentId));
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting comment:', error);
            return { success: false, message: 'Failed to delete comment' };
        }
    },
};

export default CommentService;