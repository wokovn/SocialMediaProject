import PostsController from './posts.controller.js';
import { verifyPostOwner } from '../../middlewares/posts/posts.middleware.js';
import express from 'express';

const router = express.Router();

router.get('/feed/public', PostsController.getPublicFeed);
router.get('/:id', PostsController.getPost);
router.get('/user/:userId', PostsController.getUserPosts);
router.post('/', PostsController.createPost);
router.delete('/:id', verifyPostOwner, PostsController.deletePost);
router.post('/:id/like', PostsController.likePost);
router.post('/:id/unlike', PostsController.unlikePost);

export default router;