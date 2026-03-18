
-- Zerar o contador de cliques do link "update"
UPDATE intelligent_links 
SET click_count = 0, updated_at = now()
WHERE slug = 'update';

-- Deletar os registros de cliques antigos para análise limpa
DELETE FROM link_clicks 
WHERE link_id = '3e833dc7-7a75-4a6c-9833-6dcd7c1b1266';
