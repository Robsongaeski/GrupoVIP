-- Migration add_rpc_toggle_provider

CREATE OR REPLACE FUNCTION public.admin_toggle_whatsapp_provider(p_new_provider text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify admin role
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem alterar o provedor.';
    END IF;

    -- Only allow evolution or uazapi
    IF p_new_provider NOT IN ('evolution', 'uazapi') THEN
        RAISE EXCEPTION 'Provider must be evolution ou uazapi.';
    END IF;

    -- Update system config
    UPDATE public.system_config 
    SET value = p_new_provider
    WHERE key = 'whatsapp_provider';

    -- Disconnect all instances to force reconnection with the new provider
    UPDATE public.whatsapp_instances
    SET 
        status = 'disconnected',
        qr_code = NULL,
        updated_at = now();
END;
$$;
