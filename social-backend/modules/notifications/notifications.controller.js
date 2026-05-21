import { supabase as supabaseService } from '../auth/supabase.js';
import redisClient from '../../infra/redis/redis.config.js';
import RedisKeys from '../../infra/redis/redis.key.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { data, error, count } = await supabaseService
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    return res.status(200).json({
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('[Notification] getNotifications error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    let count = 0;

    if (redisClient) {
      const redisCount = await redisClient.get(RedisKeys.notifUnread(userId));
      if (redisCount !== null) {
        count = parseInt(redisCount, 10);
        return res.status(200).json({ count });
      }
    }

    // Fallback to DB
    const { count: dbCount, error } = await supabaseService
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('deleted_at', null);

    if (error) throw error;
    count = dbCount || 0;

    // Restore to Redis
    if (redisClient) {
      await redisClient.set(RedisKeys.notifUnread(userId), count);
    }

    return res.status(200).json({ count });
  } catch (error) {
    console.error('[Notification] getUnreadCount error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const { error } = await supabaseService
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    // Decrease unread count
    if (redisClient) {
      const current = await redisClient.get(RedisKeys.notifUnread(userId));
      if (current && parseInt(current, 10) > 0) {
        await redisClient.decr(RedisKeys.notifUnread(userId));
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Notification] markAsRead error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { error } = await supabaseService
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    // Reset unread count in Redis
    if (redisClient) {
      await redisClient.set(RedisKeys.notifUnread(userId), 0);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Notification] markAllAsRead error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const { error } = await supabaseService
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() }) // Soft delete
      .eq('id', id)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Notification] deleteNotification error:', error);
    return res.status(500).json({ error: error.message });
  }
};
