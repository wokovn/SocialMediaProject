-- Migration: Add group_key for notification aggregation
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_notifications_group_key
  ON public.notifications (user_id, group_key, created_at DESC)
  WHERE deleted_at IS NULL;
