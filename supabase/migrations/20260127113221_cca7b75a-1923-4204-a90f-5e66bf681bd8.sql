-- Adicionar status 'deleted' ao enum campaign_status
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'deleted';

-- Adicionar coluna deleted_at para registro de quando foi excluída
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Comentário para documentação
COMMENT ON COLUMN campaigns.deleted_at IS 
  'Timestamp de quando a campanha foi excluída (soft delete para auditoria)';