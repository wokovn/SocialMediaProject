import PostsController from './posts.controller.js';
import { verifyPostOwner } from '../../middlewares/posts/posts.middleware.js';
import express from 'express';

const router = express.Router();

router.get('/feed/public', PostsController.getPublicFeed);
router.get('/saved', PostsController.getSavedPosts);
router.get('/user/:userId', PostsController.getUserPosts);
router.get('/:id', PostsController.getPost);
router.post('/', PostsController.createPost);
router.delete('/:id', verifyPostOwner, PostsController.deletePost);
router.post('/:id/like', PostsController.likePost);
router.post('/:id/unlike', PostsController.unlikePost);
router.post('/:id/share', PostsController.sharePost);
router.post('/:id/bookmark', PostsController.bookmarkPost);
router.delete('/:id/bookmark', PostsController.unbookmarkPost);

export default router;