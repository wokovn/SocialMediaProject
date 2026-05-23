import apiClient from './apiClient';

export const NotificationService = {
  getNotifications: async (cursor = null, limit = 50) => {
    let url = `/api/notifications?limit=${limit}`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    return await apiClient.get(url);
  },
  getUnreadCount: async () => {
    return await apiClient.get('/api/notifications/unread-count');
  },
  markAsRead: async (id) => {
    // using apiClient.request since patch isn't in convenience methods
    return await apiClient.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },
  markGroupAsRead: async (groupKey) => {
    return await apiClient.request(`/api/notifications/group/${groupKey}/read`, { method: 'PATCH' });
  },
  markAllAsRead: async () => {
    return await apiClient.request('/api/notifications/read-all', { method: 'PATCH' });
  },
  deleteNotification: async (id) => {
    return await apiClient.delete(`/api/notifications/${id}`);
  }
};
