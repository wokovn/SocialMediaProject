import CommentController from './comment.controller.js';
import express from 'express';

const router = express.Router({ mergeParams: true });

router.get('/', CommentController.getPostComments);
router.post('/', CommentController.postComment);
router.post('/:parentId/reply', CommentController.postComment);
router.get('/:commentId/replies', CommentController.getReplies);
router.post('/:commentId/like', CommentController.likeComment);
router.post('/:commentId/unlike', CommentController.unlikeComment);
router.delete('/:commentId', CommentController.deleteComment);

export default router;