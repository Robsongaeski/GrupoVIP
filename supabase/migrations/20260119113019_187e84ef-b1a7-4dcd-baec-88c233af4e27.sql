-- Update max_members to reflect actual WhatsApp limit (1024 members per group)
UPDATE public.groups 
SET max_members = 1024 
WHERE max_members < 1024;

-- Also update the default for new groups
ALTER TABLE public.groups 
ALTER COLUMN max_members SET DEFAULT 1024;