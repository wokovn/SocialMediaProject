import { Router } from 'express';
import { getNotifications, markAsRead, deleteNotification } from './notifications.controller.js';

const router = Router();

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
