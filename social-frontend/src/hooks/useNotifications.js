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
      
      const compositeKey = notif.group_key + '_' + notif.is_read;
      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          id: compositeKey,
          isGroup: true,
          groupKey: notif.group_key,
          compositeKey: compositeKey,
          type: notif.type,
          action: notif.action,
          targetUrl: notif.target_url,
          isRead: notif.is_read,
          items: [],
          createdAt: notif.created_at,
        };
        result.push(groups[compositeKey]);
      }
      
      const group = groups[compositeKey];
      group.items.push(notif);
      if (new Date(notif.created_at) > new Date(group.createdAt)) {
        group.createdAt = notif.created_at;
      }
    });
    
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const { data: notifsData, error: notifsError } = await NotificationService.getNotifications(null, 50);
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
    const { data: notifsData, error: notifsError } = await NotificationService.getNotifications(nextCursor, 50);
    
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
    if (!loading && !fetchingMore && hasMore && groupedNotifications.length > 0 && groupedNotifications.length < 10) {
      fetchMoreNotifications();
    }
  }, [loading, fetchingMore, hasMore, groupedNotifications.length, fetchMoreNotifications]);

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

  const markGroupAsRead = async (compositeKey) => {
    const group = groupedNotifications.find(g => g.compositeKey === compositeKey);
    if (!group) return;
    
    setNotifications(prev => prev.map(n => 
      n.group_key === group.groupKey && n.is_read === false ? { ...n, is_read: true } : n
    ));
    
    const { data, error } = await NotificationService.markGroupAsRead(group.groupKey);
    if (!error && data) {
      setUnreadCount(prev => Math.max(0, prev - (data.countRead || 0)));
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
