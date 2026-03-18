-- Tabela para armazenar snapshots diários de membros dos grupos
CREATE TABLE public.group_member_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garante apenas um registro por grupo por dia
  UNIQUE(group_id, recorded_at)
);

-- Índices para queries eficientes
CREATE INDEX idx_group_member_snapshots_group_id ON public.group_member_snapshots(group_id);
CREATE INDEX idx_group_member_snapshots_recorded_at ON public.group_member_snapshots(recorded_at);
CREATE INDEX idx_group_member_snapshots_group_date ON public.group_member_snapshots(group_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.group_member_snapshots ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver snapshots dos seus grupos
CREATE POLICY "Users can view snapshots of their groups"
ON public.group_member_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM groups 
    WHERE groups.id = group_member_snapshots.group_id 
    AND groups.user_id = auth.uid()
  )
);

-- Service role pode inserir (para o cron job)
CREATE POLICY "Service role can insert snapshots"
ON public.group_member_snapshots
FOR INSERT
WITH CHECK (true);

-- Função para registrar snapshot diário de todos os grupos ativos
CREATE OR REPLACE FUNCTION public.record_daily_group_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO group_member_snapshots (group_id, member_count, recorded_at)
  SELECT id, member_count, CURRENT_DATE
  FROM groups
  WHERE is_active = true
  ON CONFLICT (group_id, recorded_at) 
  DO UPDATE SET member_count = EXCLUDED.member_count;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Registrar snapshot inicial com dados atuais para os últimos 7 dias (simulando histórico)
-- Isso dá ao usuário dados iniciais para ver o gráfico
INSERT INTO group_member_snapshots (group_id, member_count, recorded_at)
SELECT id, member_count, CURRENT_DATE
FROM groups
WHERE is_active = true
ON CONFLICT (group_id, recorded_at) DO NOTHING;