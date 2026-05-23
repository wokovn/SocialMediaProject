import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentService from '../../../modules/comments/comment.service.js';
import db from '../../../modules/db/db.js';
import commentRedis from '../../../modules/comments/comment.redis.js';
import { addRankingJobWithThrottle } from '../../../infra/queue/ranking.queue.js';

// Mock dependencies
vi.mock('../../../modules/db/db.js', () => ({
    default: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
    }
}));

vi.mock('../../../modules/comments/comment.redis.js', () => ({
    default: {
        postComment: vi.fn(),
    }
}));

vi.mock('../../../infra/queue/ranking.queue.js', () => ({
    addRankingJobWithThrottle: vi.fn().mockResolvedValue(),
}));

describe('CommentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('postComment', () => {
        it('should return success false if content is missing', async () => {
            const result = await CommentService.postComment('user1', 'post1', '  ');
            expect(result.success).toBe(false);
            expect(result.message).toBe('Comment content is required');
        });

        it('should return success false if post not found', async () => {
            db.limit.mockResolvedValueOnce([]); // No post found
            const result = await CommentService.postComment('user1', 'post1', 'Hello');
            expect(result.success).toBe(false);
            expect(result.message).toBe('Post not found');
        });

        it('should create a comment successfully', async () => {
            // Mock post found
            db.limit.mockResolvedValueOnce([{ id: 'post1' }]);
            
            // Mock author found
            const mockAuthor = { id: 'user1', username: 'testuser' };
            db.limit.mockResolvedValueOnce([mockAuthor]);

            const result = await CommentService.postComment('user1', 'post1', 'Hello  ');

            expect(result.success).toBe(true);
            expect(result.comment.content).toBe('Hello');
            expect(result.comment.author).toEqual(mockAuthor);
            expect(commentRedis.postComment).toHaveBeenCalled();
            expect(addRankingJobWithThrottle).toHaveBeenCalledWith('post1', 'COMMENT');
        });

        it('should return success false if parent comment is invalid', async () => {
            db.limit.mockResolvedValueOnce([{ id: 'post1', userId: 'owner1' }]);
            db.limit.mockResolvedValueOnce([
                { id: 'parent1', postId: 'other', deletedAt: null },
            ]);

            const result = await CommentService.postComment('user1', 'post1', 'Hello', 'parent1');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Parent comment not found');
        });

        it('should return success false if author is not found', async () => {
            db.limit.mockResolvedValueOnce([{ id: 'post1', userId: 'owner1' }]);
            db.limit.mockResolvedValueOnce([]);

            const result = await CommentService.postComment('user1', 'post1', 'Hello');

            expect(result.success).toBe(false);
            expect(result.message).toBe('User not found');
        });

        it('should return failure if redis write fails', async () => {
            db.limit.mockResolvedValueOnce([{ id: 'post1', userId: 'owner1' }]);
            db.limit.mockResolvedValueOnce([{ id: 'user1', username: 'testuser' }]);
            commentRedis.postComment.mockRejectedValueOnce(new Error('redis down'));

            const result = await CommentService.postComment('user1', 'post1', 'Hello');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to post comment');
        });
    });

    describe('getPostComments', () => {
        it('returns hasMore and hasLiked info', async () => {
            const commentsList = [
                {
                    id: 'c1',
                    content: 'one',
                    createdAt: new Date('2024-01-02T00:00:00Z'),
                },
                {
                    id: 'c2',
                    content: 'two',
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                },
            ];

            db.where
                .mockReturnValueOnce({
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValueOnce(commentsList),
                    }),
                })
                .mockResolvedValueOnce([{ commentId: 'c1' }]);

            const result = await CommentService.getPostComments('post1', 'user1', 1, null);

            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('2024-01-02T00:00:00.000Z');
            expect(result.comments[0].hasLiked).toBe(true);
        });
    });

    describe('likeComment', () => {
        it('returns Already liked if user already liked', async () => {
            db.where.mockResolvedValueOnce([{ id: 'like1' }]);

            const result = await CommentService.likeComment('comment1', 'user1');

            expect(result).toEqual({ success: false, message: 'Already liked' });
        });
    });

    describe('unlikeComment', () => {
        it('returns Not liked yet when no like exists', async () => {
            db.where.mockResolvedValueOnce([]);

            const result = await CommentService.unlikeComment('comment1', 'user1');

            expect(result).toEqual({ success: false, message: 'Not liked yet' });
        });
    });

    describe('deleteComment', () => {
        it('should return success false if comment not found', async () => {
            db.where.mockResolvedValueOnce([]); 
            const result = await CommentService.deleteComment('comment1', 'user1');
            expect(result.success).toBe(false);
        });

        it('should return unauthorized if user does not own comment', async () => {
            db.where.mockResolvedValueOnce([{ id: 'comment1', userId: 'user2' }]);
            const result = await CommentService.deleteComment('comment1', 'user1');
            expect(result.success).toBe(false);
            expect(result.message).toBe('Unauthorized');
        });

        it('should delete top-level comment and its replies', async () => {
            db.where
                .mockResolvedValueOnce([{ id: 'comment1', userId: 'user1', postId: 'post1', parentId: null, repliesCount: 2 }]) // Find comment
                .mockResolvedValueOnce() // Update comment
                .mockResolvedValueOnce() // Update replies
                .mockResolvedValueOnce(); // Update post

            const result = await CommentService.deleteComment('comment1', 'user1');
            expect(result.success).toBe(true);
        });

        it('should delete reply comment and update parent counts', async () => {
            db.where.mockResolvedValueOnce([
                { id: 'comment1', userId: 'user1', postId: 'post1', parentId: 'parent1', repliesCount: 0 }
            ]);

            const result = await CommentService.deleteComment('comment1', 'user1');

            expect(result.success).toBe(true);
            expect(db.update).toHaveBeenCalledTimes(3);
        });
    });
});