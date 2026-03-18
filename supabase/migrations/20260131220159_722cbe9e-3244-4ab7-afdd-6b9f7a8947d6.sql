-- Delete all click records for the "update" link
DELETE FROM link_clicks 
WHERE link_id = '3e833dc7-7a75-4a6c-9833-6dcd7c1b1266';

-- Reset the click count on the link itself
UPDATE intelligent_links 
SET click_count = 0 
WHERE id = '3e833dc7-7a75-4a6c-9833-6dcd7c1b1266';