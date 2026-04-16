import { Router } from 'express';
import UsersController from './users.controller.js';

const router = Router();

router.get('/me', UsersController.getMe);
router.get('/:userId', UsersController.getProfile);
router.post('/:userId/follow', UsersController.followUser);
router.delete('/:userId/follow', UsersController.unfollowUser);

export default router;
