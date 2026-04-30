import { Router } from 'express';
import { getAdminStats } from './admin.controller.js';

const router = Router();

// Route Public không cần JWT
router.get('/stats', getAdminStats);

export default router;
