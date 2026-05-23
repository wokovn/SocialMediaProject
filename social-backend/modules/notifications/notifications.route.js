import { Router } from 'express';
import { getNotifications, getUnreadCount, markAsRead, markGroupAsRead, markAllAsRead, deleteNotification } from './notifications.controller.js';

const router = Router();

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.patch('/group/:groupKey/read', markGroupAsRead);
router.delete('/:id', deleteNotification);

export default router;
