import { Router } from 'express';
import UsersController from './users.controller.js';

const router = Router();

router.get('/check-username', UsersController.checkUsername);

export default router;
