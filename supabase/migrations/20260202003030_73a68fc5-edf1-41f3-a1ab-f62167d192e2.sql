-- Reset clicks for 'update' link to monitor new fix
UPDATE intelligent_links 
SET click_count = 0, updated_at = now()
WHERE slug = 'update';

DELETE FROM link_clicks 
WHERE link_id = (SELECT id FROM intelligent_links WHERE slug = 'update');