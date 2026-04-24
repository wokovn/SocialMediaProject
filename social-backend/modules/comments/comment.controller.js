import CommentService from './comment.service.js';

const CommentController = {
    postComment: async (req, res) => {
        const userId = req.user.sub;
        const { postId } = req.params;
        const { content } = req.body;
        const parentId = req.params.parentId || null;
        const result = await CommentService.postComment(userId, postId, content, parentId);
        if (result.success) {
            res.status(201).json(result.comment);
        } else if (result.message === 'Post not found' || result.message === 'Parent comment not found') {
            res.status(404).json({ message: result.message });
        } else if (result.message === 'Comment content is required') {
            res.status(400).json({ message: result.message });
        } else {
            res.status(500).json({ message: result.message });
        }
    },

    getPostComments: async (req, res) => {
        const { postId } = req.params;
        const userId = req.user.sub;
        const limit = parseInt(req.query.limit) || 20;
        const cursor = req.query.cursor || null;
        const result = await CommentService.getPostComments(postId, userId, limit, cursor);
        if (result.success) {
            res.status(200).json({
                comments: result.comments,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
            });
        } else {
            res.status(500).json({ message: result.message });
        }
    },

    getReplies: async (req, res) => {
        const { commentId } = req.params;
        const userId = req.user.sub;
        const result = await CommentService.getReplies(commentId, userId);
        if (result.success) {
            res.status(200).json({ replies: result.replies });
        } else {
            res.status(500).json({ message: result.message });
        }
    },

    likeComment: async (req, res) => {
        const userId = req.user.sub;
        const { commentId } = req.params;
        const result = await CommentService.likeComment(commentId, userId);
        if (result.success) {
            res.status(200).json({ message: 'Comment liked successfully' });
        } else {
            res.status(400).json({ message: result.message });
        }
    },

    unlikeComment: async (req, res) => {
        const userId = req.user.sub;
        const { commentId } = req.params;
        const result = await CommentService.unlikeComment(commentId, userId);
        if (result.success) {
            res.status(200).json({ message: 'Comment unliked successfully' });
        } else {
            res.status(400).json({ message: result.message });
        }
    },

    deleteComment: async (req, res) => {
        const userId = req.user.sub;
        const { commentId } = req.params;
        const result = await CommentService.deleteComment(commentId, userId);
        if (result.success) {
            res.status(200).json({ message: 'Comment deleted successfully' });
        } else if (result.message === 'Unauthorized') {
            res.status(403).json({ message: result.message });
        } else {
            res.status(500).json({ message: result.message });
        }
    },
};

export default CommentController;