-- Add 'direct_chat' to link_mode enum
ALTER TYPE link_mode ADD VALUE IF NOT EXISTS 'direct_chat';

-- Add default_message column to intelligent_links
ALTER TABLE intelligent_links ADD COLUMN IF NOT EXISTS default_message TEXT;

-- Create table for phone numbers in direct chat links
CREATE TABLE IF NOT EXISTS link_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES intelligent_links(id) ON DELETE CASCADE,
  internal_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  current_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add phone_number_id to link_clicks for tracking
ALTER TABLE link_clicks ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES link_phone_numbers(id);

-- Enable RLS on link_phone_numbers
ALTER TABLE link_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can manage phone numbers of their links
CREATE POLICY "Users can manage phone numbers of their links"
ON link_phone_numbers
FOR ALL
USING (EXISTS (
  SELECT 1 FROM intelligent_links
  WHERE intelligent_links.id = link_phone_numbers.link_id
  AND intelligent_links.user_id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_link_phone_numbers_link_id ON link_phone_numbers(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_phone_number_id ON link_clicks(phone_number_id);