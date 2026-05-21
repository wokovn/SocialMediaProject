import apiClient from './apiClient';

export const NotificationService = {
  getNotifications: async (cursor = null, limit = 20) => {
    let url = `/api/notifications?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return await apiClient.get(url);
  },
  getUnreadCount: async () => {
    return await apiClient.get('/api/notifications/unread-count');
  },
  markAsRead: async (id) => {
    // using apiClient.request since patch isn't in convenience methods
    return await apiClient.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },
  markAllAsRead: async () => {
    return await apiClient.request('/api/notifications/read-all', { method: 'PATCH' });
  },
  deleteNotification: async (id) => {
    return await apiClient.delete(`/api/notifications/${id}`);
  }
};
