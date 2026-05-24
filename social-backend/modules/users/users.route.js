import { Router } from 'express';
import UsersController from './users.controller.js';

const router = Router();

// Own profile
router.get('/me', UsersController.getMe);
router.patch('/me', UsersController.updateMe);
router.post('/me/banner', UsersController.uploadBanner);

// Search
router.get('/search', UsersController.search);

// Follow/unfollow
router.post('/:userId/follow', UsersController.followUser);
router.delete('/:userId/follow', UsersController.unfollowUser);

// Followers / Following lists
router.get('/:userId/followers', UsersController.getFollowers);
router.get('/:userId/following', UsersController.getFollowing);

// Profile lookup
router.get('/:userId/relationship', UsersController.getRelationship);
router.get('/by-username/:username', UsersController.getProfileByUsername);
router.get('/:userId', UsersController.getProfile);

export default router;
