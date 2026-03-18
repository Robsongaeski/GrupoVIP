import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verificar autenticação usando o header Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extrair o JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Criar cliente com anon key para validar o token do usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Usar getClaims para validar o JWT
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = claimsData.claims.sub as string
    const userEmail = claimsData.claims.email as string
    console.log('User authenticated:', userId)
    
    // Cliente com service role para operações no banco
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar configurações do Mercado Pago
    const { data: configs } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['mercadopago_access_token'])

    const configMap = new Map(configs?.map(c => [c.key, c.value]) || [])
    const accessToken = configMap.get('mercadopago_access_token')

    if (!accessToken) {
      console.error('mercadopago_access_token not configured')
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Ler dados do request
    const { plan_id, payment_method, card_token, payer } = await req.json()

    if (!plan_id) {
      return new Response(JSON.stringify({ error: 'plan_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      console.error('Plan not found:', planError)
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Plan found:', plan.name, 'Price:', plan.price, 'Payment method:', payment_method)

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()

    const payerEmail = profile?.email || userEmail
    const payerName = profile?.full_name || 'Cliente'

    // Se o plano for gratuito
    if (plan.price === 0) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['active', 'trial'])
        .single()

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update({
            plan_id: plan.id,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_id: plan.id,
            status: 'active',
            periodicity: 'monthly'
          })
      }

      return new Response(JSON.stringify({ 
        success: true, 
        type: 'free',
        message: 'Plano gratuito ativado com sucesso!'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ===== PAGAMENTO VIA PIX =====
    if (payment_method === 'pix') {
      console.log('Processing PIX payment')

      // Criar pagamento único via PIX
      const paymentData = {
        transaction_amount: plan.price,
        description: `Assinatura ${plan.name} - ZapGrupos`,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: payerName.split(' ')[0] || 'Cliente',
          last_name: payerName.split(' ').slice(1).join(' ') || 'ZapGrupos',
          identification: payer?.identification || {
            type: 'CPF',
            number: '00000000000'
          }
        },
        // Referência externa legível para o Mercado Pago
        external_reference: `VIPSEND|${payerName.replace(/[|]/g, '')}|${plan.name}|${userId}|${plan.id}`
      }

      console.log('Creating PIX payment:', JSON.stringify(paymentData))

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': `${userId}-${plan.id}-${Date.now()}`
        },
        body: JSON.stringify(paymentData)
      })

      const mpResult = await mpResponse.json()

      if (!mpResponse.ok) {
        console.error('Mercado Pago PIX error:', JSON.stringify(mpResult))
        return new Response(JSON.stringify({ 
          success: false,
          error: mpResult.message || 'Erro ao gerar PIX',
          details: mpResult
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('PIX payment created:', mpResult.id, 'Status:', mpResult.status)

      // Registrar pagamento pendente
      await supabase.from('payments').insert({
        user_id: userId,
        external_payment_id: mpResult.id.toString(),
        amount: plan.price,
        status: 'pending',
        payment_type: 'pix',
        raw_data: mpResult
      })

      // Criar/atualizar assinatura como payment_pending
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single()

      const subscriptionData = {
        plan_id: plan.id,
        status: 'payment_pending' as const,
        updated_at: new Date().toISOString()
      }

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id)
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            periodicity: plan.periodicity,
            ...subscriptionData
          })
      }

      return new Response(JSON.stringify({
        success: true,
        type: 'pix',
        payment_id: mpResult.id,
        pix: {
          qr_code: mpResult.point_of_interaction?.transaction_data?.qr_code || '',
          qr_code_base64: mpResult.point_of_interaction?.transaction_data?.qr_code_base64 || '',
          ticket_url: mpResult.point_of_interaction?.transaction_data?.ticket_url || ''
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ===== PAGAMENTO VIA CARTÃO (RECORRENTE) =====
    if (payment_method === 'card' && card_token) {
      console.log('Processing card payment with recurrence')
      
      // Determinar back_url baseado no origin ou fallback
      const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://www.vipsend.com.br'
      const backUrl = `${origin}/planos?status=success`
      
      // Criar assinatura recorrente com cartão tokenizado
      const preapprovalData = {
        reason: `Assinatura ${plan.name} - VIPSend`,
        // Referência externa legível: VIPSEND|Nome|Plano|user_id|plan_id
        external_reference: `VIPSEND|${payerName.replace(/[|]/g, '')}|${plan.name}|${userId}|${plan.id}`,
        payer_email: payerEmail,
        card_token_id: card_token,
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: plan.periodicity === 'yearly' ? 'years' : 'months',
          transaction_amount: plan.price,
          currency_id: 'BRL'
        },
        status: 'authorized'
      }

      console.log('Creating preapproval with card:', JSON.stringify(preapprovalData))

      const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(preapprovalData)
      })

      const mpResult = await mpResponse.json()

      if (!mpResponse.ok) {
        console.error('Mercado Pago error:', JSON.stringify(mpResult))
        
        let errorMessage = 'Erro ao processar pagamento'
        if (mpResult.message) {
          errorMessage = mpResult.message
        } else if (mpResult.cause?.[0]?.description) {
          errorMessage = mpResult.cause[0].description
        }
        
        return new Response(JSON.stringify({ 
          success: false,
          error: errorMessage,
          details: mpResult
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Preapproval created:', mpResult.id, 'Status:', mpResult.status)

      // Calcular data de expiração
      const expiresAt = new Date()
      if (plan.periodicity === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      }

      // Criar ou atualizar assinatura no banco
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single()

      const subscriptionData = {
        plan_id: plan.id,
        external_subscription_id: mpResult.id,
        status: mpResult.status === 'authorized' ? 'active' as const : 'payment_pending' as const,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id)
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            periodicity: plan.periodicity,
            ...subscriptionData
          })
      }

      // Atualizar perfil
      await supabase
        .from('profiles')
        .update({
          subscription_status: mpResult.status === 'authorized' ? 'active' : 'payment_pending',
          subscription_started_at: new Date().toISOString(),
          subscription_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId)

      return new Response(JSON.stringify({
        success: true,
        type: 'card',
        subscription_id: mpResult.id,
        status: mpResult.status,
        message: 'Assinatura realizada com sucesso!'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fallback: Checkout com redirect (sem payment_method especificado)
    const preapprovalData = {
      reason: `Assinatura ${plan.name} - VIPSend`,
      auto_recurring: {
        frequency: 1,
        frequency_type: plan.periodicity === 'yearly' ? 'years' : 'months',
        transaction_amount: plan.price,
        currency_id: 'BRL'
      },
      payer_email: payerEmail,
      back_url: `${req.headers.get('origin') || 'https://www.vipsend.com.br'}/dashboard/plans?status=success`,
      // Referência externa legível
      external_reference: `VIPSEND|${payerName.replace(/[|]/g, '')}|${plan.name}|${userId}|${plan.id}`,
      status: 'pending'
    }

    console.log('Creating preapproval (redirect):', JSON.stringify(preapprovalData))

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preapprovalData)
    })

    const mpResult = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', JSON.stringify(mpResult))
      return new Response(JSON.stringify({ 
        error: 'Failed to create subscription',
        details: mpResult.message || mpResult.cause?.[0]?.description || 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Preapproval created:', mpResult.id, 'Init point:', mpResult.init_point)

    // Criar ou atualizar assinatura pendente no banco
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existingSub) {
      await supabase
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          external_subscription_id: mpResult.id,
          status: 'payment_pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id)
    } else {
      await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          external_subscription_id: mpResult.id,
          status: 'payment_pending',
          periodicity: plan.periodicity
        })
    }

    return new Response(JSON.stringify({
      success: true,
      type: 'redirect',
      init_point: mpResult.init_point,
      subscription_id: mpResult.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating subscription:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
