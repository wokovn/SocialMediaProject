import {Router} from 'express';
import authController from './auth.controller.js';
import { verifySupabaseJWT } from '../../middlewares/jwt/jwt.middleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/logout', verifySupabaseJWT, authController.logout);

export default router;