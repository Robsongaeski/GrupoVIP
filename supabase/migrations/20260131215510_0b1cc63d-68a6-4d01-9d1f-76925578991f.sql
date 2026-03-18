-- Add is_bot column to track bot/crawler clicks
ALTER TABLE link_clicks 
ADD COLUMN is_bot BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering
CREATE INDEX idx_link_clicks_is_bot ON link_clicks(is_bot);

-- Update existing records based on user_agent patterns
-- Note: FB_IAB, FBAV, IABMV are real users in Facebook/Instagram apps, NOT bots
UPDATE link_clicks SET is_bot = TRUE 
WHERE user_agent IS NOT NULL
  AND NOT (user_agent ILIKE '%FB_IAB%' OR user_agent ILIKE '%FBAV%' OR user_agent ILIKE '%IABMV%')
  AND (
    user_agent ILIKE '%facebookexternalhit%'
    OR user_agent ILIKE '%facebot%'
    OR user_agent ILIKE '%googlebot%'
    OR user_agent ILIKE '%bingbot%'
    OR user_agent ILIKE '%whatsapp%'
    OR user_agent ILIKE '%twitterbot%'
    OR user_agent ILIKE '%linkedinbot%'
    OR user_agent ILIKE '%slurp%'
    OR user_agent ILIKE '%crawler%'
    OR user_agent ILIKE '%spider%'
    OR user_agent ILIKE '%headless%'
    OR user_agent ILIKE '%phantom%'
    OR user_agent ILIKE '%puppeteer%'
    OR user_agent ~* '\ybot\y'
  );