-- Create group_instances table for N:N relationship between groups and instances
CREATE TABLE public.group_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, instance_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_group_instances_group_id ON public.group_instances(group_id);
CREATE INDEX idx_group_instances_instance_id ON public.group_instances(instance_id);

-- Enable RLS
ALTER TABLE public.group_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/manage their own group-instance relationships
CREATE POLICY "Users can view their own group instances"
ON public.group_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_instances.group_id
    AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own group instances"
ON public.group_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_instances.group_id
    AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own group instances"
ON public.group_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_instances.group_id
    AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own group instances"
ON public.group_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_instances.group_id
    AND g.user_id = auth.uid()
  )
);

-- Migrate existing data: create group_instances entries from existing groups
INSERT INTO public.group_instances (group_id, instance_id, is_admin, synced_at, created_at)
SELECT 
  g.id as group_id,
  g.instance_id,
  g.is_user_admin as is_admin,
  g.synced_at,
  g.created_at
FROM public.groups g
WHERE g.instance_id IS NOT NULL
ON CONFLICT (group_id, instance_id) DO NOTHING;