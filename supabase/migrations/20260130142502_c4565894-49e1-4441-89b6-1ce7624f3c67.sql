-- Corrigir policy de notificações para ser mais restritiva
-- Apenas admins ou o sistema via triggers podem criar notificações

DROP POLICY IF EXISTS "System can create notifications" ON public.ticket_notifications;

-- Criar policy mais segura: apenas através de triggers (SECURITY DEFINER)
-- Usuários normais não podem inserir diretamente
CREATE POLICY "Admins can create notifications"
  ON public.ticket_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));