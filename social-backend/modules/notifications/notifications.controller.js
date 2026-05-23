import { supabase as supabaseService } from '../auth/supabase.js';
import redisClient from '../../infra/redis/redis.config.js';
import RedisKeys from '../../infra/redis/redis.key.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.sub;
    const cursor = req.query.cursor;
    const limit = parseInt(req.query.limit) || 20;
    
    let query = supabaseService
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }
      
    const { data, error, count } = await query;
      
    if (error) throw error;
    
    return res.status(200).json({
      data,
      meta: {
        total: count,
        limit,
        nextCursor: data.length > 0 ? data[data.length - 1].created_at : null
      }
    });
  } catch (error) {
    console.error('[Notification] getNotifications error FULL:', error);
    return res.status(500).json({ error: error ? (error.message || String(error)) : 'Unknown error' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.sub;
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
    console.error('[Notification] getUnreadCount error FULL:', error);
    return res.status(500).json({ error: error ? (error.message || String(error)) : 'Unknown error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.sub;
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
    const userId = req.user.sub;
    
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
    const userId = req.user.sub;
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

export const markGroupAsRead = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { groupKey } = req.params;
    
    // Get count of unread items in this group
    const { count, error: countError } = await supabaseService
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('group_key', groupKey)
      .eq('is_read', false)
      .eq('user_id', userId);
      
    if (countError) throw countError;
    
    if (count > 0) {
      const { error } = await supabaseService
        .from('notifications')
        .update({ is_read: true })
        .eq('group_key', groupKey)
        .eq('is_read', false)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Decrease unread count
      if (redisClient) {
        const current = await redisClient.get(RedisKeys.notifUnread(userId));
        if (current) {
          const newCount = Math.max(0, parseInt(current, 10) - count);
          await redisClient.set(RedisKeys.notifUnread(userId), newCount);
        }
      }
    }

    return res.status(200).json({ success: true, countRead: count || 0 });
  } catch (error) {
    console.error('[Notification] markGroupAsRead error:', error);
    return res.status(500).json({ error: error.message });
  }
};
