-- Migration: Create Notifications Table with Soft Delete and Indexes

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT public.uuid_generate_v7() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,   -- e.g., 'INTERACTION', 'NEW_POST', 'SYSTEM'
    action VARCHAR(50) NOT NULL, -- e.g., 'LIKE', 'COMMENT', 'MENTION'
    target_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for fetching active notifications of a user efficiently
CREATE INDEX IF NOT EXISTS idx_notifications_active_user 
ON public.notifications (user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for counting unread notifications efficiently
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications (user_id) 
WHERE is_read = false AND deleted_at IS NULL;

-- Secure the table with RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own active notifications
CREATE POLICY select_own_notifications 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Policy: Users can update their own notifications (e.g., mark as read, soft delete)
CREATE POLICY update_own_notifications 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Only system/service role should be inserting notifications usually,
-- but if we allow insert via API, restrict to their own
CREATE POLICY insert_notifications 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
