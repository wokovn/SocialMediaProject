import { useState, useEffect, useCallback } from 'react';
import { NotificationService } from '../services/notificationService';
import { useSocket } from '../lib/socketProvider';

export const useNotifications = () => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [groupedNotifications, setGroupedNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const groupNotifications = (notifs) => {
    const groups = {};
    const result = [];
    
    notifs.forEach(notif => {
      if (!notif.group_key) {
        result.push({
          id: notif.id,
          isGroup: false,
          isRead: notif.is_read,
          createdAt: notif.created_at,
          data: notif,
        });
        return;
      }
      
      if (!groups[notif.group_key]) {
        groups[notif.group_key] = {
          id: notif.group_key,
          isGroup: true,
          groupKey: notif.group_key,
          type: notif.type,
          action: notif.action,
          targetUrl: notif.target_url,
          isRead: true,
          items: [],
          createdAt: notif.created_at,
        };
        result.push(groups[notif.group_key]);
      }
      
      const group = groups[notif.group_key];
      group.items.push(notif);
      if (!notif.is_read) {
        group.isRead = false;
      }
      if (new Date(notif.created_at) > new Date(group.createdAt)) {
        group.createdAt = notif.created_at;
      }
    });
    
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const { data: notifsData, error: notifsError } = await NotificationService.getNotifications(null, 20);
    const { data: countData, error: countError } = await NotificationService.getUnreadCount();
    
    if (!notifsError && notifsData?.data) {
      setNotifications(notifsData.data);
      setNextCursor(notifsData.meta?.nextCursor);
      setHasMore(!!notifsData.meta?.nextCursor);
    }
    
    if (!countError && countData) {
      setUnreadCount(countData.count);
    }
    setLoading(false);
  }, []);

  const fetchMoreNotifications = useCallback(async () => {
    if (!hasMore || fetchingMore || !nextCursor) return;
    
    setFetchingMore(true);
    const { data: notifsData, error: notifsError } = await NotificationService.getNotifications(nextCursor, 20);
    
    if (!notifsError && notifsData?.data) {
      setNotifications(prev => {
        // filter out duplicates just in case
        const existingIds = new Set(prev.map(n => n.id));
        const newItems = notifsData.data.filter(n => !existingIds.has(n.id));
        return [...prev, ...newItems];
      });
      setNextCursor(notifsData.meta?.nextCursor);
      setHasMore(!!notifsData.meta?.nextCursor);
    }
    setFetchingMore(false);
  }, [hasMore, fetchingMore, nextCursor]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    setGroupedNotifications(groupNotifications(notifications));
  }, [notifications]);

  useEffect(() => {
    if (!socket) return;

    socket.on('NEW_NOTIFICATION', (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
    });

    socket.on('UNREAD_COUNT', (data) => {
      setUnreadCount(data.count);
    });

    return () => {
      socket.off('NEW_NOTIFICATION');
      socket.off('UNREAD_COUNT');
    };
  }, [socket]);

  const markAsRead = async (notificationId) => {
    const { error } = await NotificationService.markAsRead(notificationId);
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markGroupAsRead = async (groupKey) => {
    const group = groupedNotifications.find(g => g.groupKey === groupKey);
    if (!group) return;
    
    const unreadItems = group.items.filter(item => !item.is_read);
    
    setNotifications(prev => prev.map(n => 
      n.group_key === groupKey ? { ...n, is_read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - unreadItems.length));
    
    for (const item of unreadItems) {
      await NotificationService.markAsRead(item.id);
    }
  };

  const markAllAsRead = async () => {
    const { error } = await NotificationService.markAllAsRead();
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  return {
    notifications: groupedNotifications,
    rawNotifications: notifications,
    unreadCount,
    loading,
    fetchingMore,
    hasMore,
    markAsRead,
    markGroupAsRead,
    markAllAsRead,
    fetchNotifications,
    fetchMoreNotifications,
  };
};
