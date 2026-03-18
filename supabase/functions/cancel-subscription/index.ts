import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('User authenticated:', user.id)

    // Buscar assinatura do usuário
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      console.error('Subscription not found:', subError)
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Subscription found:', subscription.id, 'External ID:', subscription.external_subscription_id)

    // Se tiver assinatura no Mercado Pago, cancelar lá também
    if (subscription.external_subscription_id) {
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['mercadopago_access_token'])

      const configMap = new Map(configs?.map(c => [c.key, c.value]) || [])
      const accessToken = configMap.get('mercadopago_access_token')

      if (accessToken) {
        console.log('Cancelling subscription on Mercado Pago:', subscription.external_subscription_id)

        try {
          const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.external_subscription_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ status: 'cancelled' })
          })

          const mpResult = await mpResponse.json()
          console.log('Mercado Pago cancel result:', JSON.stringify(mpResult))

          if (!mpResponse.ok) {
            console.warn('Failed to cancel on Mercado Pago:', mpResult)
            // Continua mesmo se falhar no MP
          }
        } catch (mpError) {
          console.warn('Error cancelling on Mercado Pago:', mpError)
          // Continua mesmo se der erro
        }
      }
    }

    // Atualizar assinatura no banco
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('Error updating subscription:', updateError)
      throw updateError
    }

    // Registrar no histórico
    await supabase.from('subscription_history').insert({
      user_id: user.id,
      subscription_id: subscription.id,
      old_status: subscription.status,
      new_status: 'cancelled',
      reason: 'Cancelado pelo usuário'
    })

    // Atualizar perfil
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'cancelled'
      })
      .eq('id', user.id)

    // Log de atividade
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'cancel_subscription',
      entity_type: 'subscription',
      entity_id: subscription.id,
      details: { cancelled_at: new Date().toISOString() }
    })

    console.log('Subscription cancelled successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Assinatura cancelada com sucesso. Você ainda terá acesso até o fim do período pago.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error cancelling subscription:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
