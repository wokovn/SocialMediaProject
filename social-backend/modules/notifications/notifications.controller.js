import { supabase as supabaseService } from '../auth/supabase.js';

export const getNotifications = async (req, res) => {
  try {
    // req.user được set từ middleware verifySupabaseJWT
    const userId = req.user.id;
    
    const { data, error } = await supabaseService
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Notification] getNotifications error:', error);
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
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Notification] markAsRead error:', error);
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
