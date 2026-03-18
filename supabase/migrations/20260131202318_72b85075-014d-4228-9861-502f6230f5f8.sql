-- Corrigir max_members de todos os grupos para 1024 (limite real do WhatsApp)
UPDATE groups 
SET max_members = 1024 
WHERE max_members != 1024;

-- Atualizar o valor padrão da coluna para garantir novos grupos
ALTER TABLE groups 
ALTER COLUMN max_members SET DEFAULT 1024;