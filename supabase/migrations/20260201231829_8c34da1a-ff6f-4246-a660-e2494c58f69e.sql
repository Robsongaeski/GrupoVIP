-- Desabilitar landing page do link "update" para redirecionamento direto
UPDATE intelligent_links 
SET show_landing_page = false, updated_at = now()
WHERE slug = 'update';