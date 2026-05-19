import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentService from './comment.service.js';
import db from '../db/db.js';
import commentRedis from './comment.redis.js';
import { addRankingJobWithThrottle } from '../../infra/queue/ranking.queue.js';

// Mock dependencies
vi.mock('../db/db.js', () => ({
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

vi.mock('./comment.redis.js', () => ({
    default: {
        postComment: vi.fn(),
    }
}));

vi.mock('../../infra/queue/ranking.queue.js', () => ({
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
    });
});