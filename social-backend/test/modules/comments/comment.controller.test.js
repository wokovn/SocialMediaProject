import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentController from '../../../modules/comments/comment.controller.js';
import CommentService from '../../../modules/comments/comment.service.js';

vi.mock('../../../modules/comments/comment.service.js', () => ({
    default: {
        postComment: vi.fn(),
        getPostComments: vi.fn(),
        getReplies: vi.fn(),
        likeComment: vi.fn(),
        unlikeComment: vi.fn(),
        deleteComment: vi.fn(),
    }
}));

describe('CommentController', () => {
    let req;
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            user: { sub: 'user123' },
            params: {},
            body: {},
            query: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    describe('postComment', () => {
        it('should return 201 and comment data on success', async () => {
            req.params = { postId: 'post123' };
            req.body = { content: 'Nice post!' };
            const mockComment = { id: 'comment1', content: 'Nice post!' };
            
            CommentService.postComment.mockResolvedValue({ success: true, comment: mockComment });
            
            await CommentController.postComment(req, res);
            
            expect(CommentService.postComment).toHaveBeenCalledWith('user123', 'post123', 'Nice post!', null);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockComment);
        });

        it('should return 400 if content is missing', async () => {
            req.params = { postId: 'post123' };
            CommentService.postComment.mockResolvedValue({ success: false, message: 'Comment content is required' });
            
            await CommentController.postComment(req, res);
            
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Comment content is required' });
        });
        
        it('should return 404 if post not found', async () => {
            req.params = { postId: 'post123' };
            CommentService.postComment.mockResolvedValue({ success: false, message: 'Post not found' });
            
            await CommentController.postComment(req, res);
            
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Post not found' });
        });
    });

    describe('getPostComments', () => {
        it('should return comments with pagination info on success', async () => {
            req.params = { postId: 'post123' };
            req.query = { limit: '10', cursor: '2023-01-01' };
            
            CommentService.getPostComments.mockResolvedValue({
                success: true,
                comments: [{ id: 'c1' }],
                hasMore: false,
                nextCursor: null
            });
            
            await CommentController.getPostComments(req, res);
            
            expect(CommentService.getPostComments).toHaveBeenCalledWith('post123', 'user123', 10, '2023-01-01');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                comments: [{ id: 'c1' }],
                hasMore: false,
                nextCursor: null
            });
        });

        it('should return 500 on server error', async () => {
             req.params = { postId: 'post123' };
             CommentService.getPostComments.mockResolvedValue({ success: false, message: 'Server error' });
             
             await CommentController.getPostComments(req, res);
             
             expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getReplies', () => {
        it('should return replies on success', async () => {
            req.params = { commentId: 'c123' };
            CommentService.getReplies.mockResolvedValue({ success: true, replies: [{ id: 'r1' }] });
            
            await CommentController.getReplies(req, res);
            
            expect(CommentService.getReplies).toHaveBeenCalledWith('c123', 'user123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ replies: [{ id: 'r1' }] });
        });
    });

    describe('likeComment', () => {
        it('should return 200 on success', async () => {
            req.params = { commentId: 'c123' };
            CommentService.likeComment.mockResolvedValue({ success: true });
            
            await CommentController.likeComment(req, res);
            
            expect(CommentService.likeComment).toHaveBeenCalledWith('c123', 'user123');
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('deleteComment', () => {
        it('should return 200 on success', async () => {
            req.params = { commentId: 'c123' };
            CommentService.deleteComment.mockResolvedValue({ success: true });
            
            await CommentController.deleteComment(req, res);
            
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 403 on Unauthorized', async () => {
            req.params = { commentId: 'c123' };
            CommentService.deleteComment.mockResolvedValue({ success: false, message: 'Unauthorized' });
            
            await CommentController.deleteComment(req, res);
            
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
        });
    });
});