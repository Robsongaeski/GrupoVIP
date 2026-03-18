-- Tabela de histórico para rastrear grupos vinculados a links
CREATE TABLE IF NOT EXISTS link_group_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES intelligent_links(id) ON DELETE CASCADE,
  whatsapp_id TEXT NOT NULL,
  group_name TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ,
  UNIQUE(link_id, whatsapp_id)
);

-- Índices para performance
CREATE INDEX idx_lgh_link_id ON link_group_history(link_id);
CREATE INDEX idx_lgh_whatsapp_id ON link_group_history(whatsapp_id);
CREATE INDEX idx_lgh_removed ON link_group_history(link_id) WHERE removed_at IS NOT NULL;

-- RLS
ALTER TABLE link_group_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link history" ON link_group_history
  FOR SELECT USING (
    link_id IN (SELECT id FROM intelligent_links WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage history" ON link_group_history
  FOR ALL USING (true) WITH CHECK (true);

-- Função trigger para rastrear mudanças em link_groups
CREATE OR REPLACE FUNCTION track_link_group_history()
RETURNS TRIGGER AS $$
DECLARE
  v_whatsapp_id TEXT;
  v_group_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT whatsapp_id, name INTO v_whatsapp_id, v_group_name
    FROM groups WHERE id = NEW.group_id;
    
    IF v_whatsapp_id IS NOT NULL THEN
      INSERT INTO link_group_history (link_id, whatsapp_id, group_name, added_at)
      VALUES (NEW.link_id, v_whatsapp_id, v_group_name, now())
      ON CONFLICT (link_id, whatsapp_id) DO UPDATE 
      SET removed_at = NULL, added_at = now(), group_name = EXCLUDED.group_name;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    SELECT whatsapp_id INTO v_whatsapp_id FROM groups WHERE id = OLD.group_id;
    
    IF v_whatsapp_id IS NOT NULL THEN
      UPDATE link_group_history 
      SET removed_at = now()
      WHERE link_id = OLD.link_id AND whatsapp_id = v_whatsapp_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger
CREATE TRIGGER trg_track_link_groups
  AFTER INSERT OR DELETE ON link_groups
  FOR EACH ROW EXECUTE FUNCTION track_link_group_history();

-- Função para detectar links órfãos (com grupos perdidos mas recuperáveis)
CREATE OR REPLACE FUNCTION get_orphaned_links(p_user_id UUID)
RETURNS TABLE (
  link_id UUID,
  link_name TEXT,
  link_slug TEXT,
  missing_groups BIGINT,
  recoverable_groups BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.id,
    il.name,
    il.slug,
    COUNT(DISTINCT lgh.whatsapp_id) FILTER (WHERE lgh.removed_at IS NOT NULL),
    COUNT(DISTINCT g.id) FILTER (WHERE lgh.removed_at IS NOT NULL AND g.id IS NOT NULL)
  FROM intelligent_links il
  LEFT JOIN link_group_history lgh ON il.id = lgh.link_id
  LEFT JOIN groups g ON g.whatsapp_id = lgh.whatsapp_id AND g.user_id = p_user_id
  WHERE il.user_id = p_user_id
  AND il.status = 'active'
  GROUP BY il.id, il.name, il.slug
  HAVING COUNT(DISTINCT lgh.whatsapp_id) FILTER (WHERE lgh.removed_at IS NOT NULL) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para recuperar grupos de um link específico
CREATE OR REPLACE FUNCTION recover_link_groups(p_link_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_recovered INTEGER := 0;
  v_history RECORD;
  v_group_id UUID;
BEGIN
  -- Verificar se o link pertence ao usuário
  IF NOT EXISTS (SELECT 1 FROM intelligent_links WHERE id = p_link_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Link not found or access denied';
  END IF;

  -- Buscar grupos removidos que agora existem novamente
  FOR v_history IN
    SELECT lgh.whatsapp_id, lgh.link_id
    FROM link_group_history lgh
    WHERE lgh.link_id = p_link_id
    AND lgh.removed_at IS NOT NULL
  LOOP
    -- Verificar se grupo existe para o usuário
    SELECT g.id INTO v_group_id
    FROM groups g
    WHERE g.whatsapp_id = v_history.whatsapp_id
    AND g.user_id = p_user_id
    LIMIT 1;

    IF v_group_id IS NOT NULL THEN
      -- Verificar se já não existe o vínculo
      IF NOT EXISTS (
        SELECT 1 FROM link_groups 
        WHERE link_id = p_link_id AND group_id = v_group_id
      ) THEN
        -- Reconectar
        INSERT INTO link_groups (link_id, group_id, is_active, priority)
        VALUES (p_link_id, v_group_id, true, 0);
        v_recovered := v_recovered + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_recovered;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Popular histórico com dados existentes
INSERT INTO link_group_history (link_id, whatsapp_id, group_name, added_at)
SELECT lg.link_id, g.whatsapp_id, g.name, lg.created_at
FROM link_groups lg
JOIN groups g ON g.id = lg.group_id
ON CONFLICT (link_id, whatsapp_id) DO NOTHING;