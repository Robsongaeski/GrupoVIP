-- Reset all existing groups to inactive by default
UPDATE public.groups SET is_active = false WHERE is_active = true;