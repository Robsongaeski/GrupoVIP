-- Add is_user_admin column to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS is_user_admin boolean DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_groups_is_user_admin ON public.groups(user_id, is_user_admin);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON public.groups(user_id, is_active);