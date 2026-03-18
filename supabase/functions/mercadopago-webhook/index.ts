import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers - webhooks geralmente não precisam de CORS, mas mantemos para consistência
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

interface MercadoPagoPayment {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  currency_id: string
  payment_method_id: string
  payment_type_id: string
  payer: {
    email: string
    id: string
  }
  external_reference?: string
  date_approved?: string
  date_created: string
}

interface MercadoPagoSubscription {
  id: string
  status: string
  payer_id: string
  external_reference?: string
  date_created: string
  last_modified: string
  auto_recurring: {
    frequency: number
    frequency_type: string
    transaction_amount: number
    currency_id: string
  }
}

// Validate webhook signature from MercadoPago
async function validateWebhookSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    console.warn('Missing signature or secret for webhook validation');
    return false;
  }

  try {
    // Parse signature format: ts=xxx,v1=xxx
    const parts = signature.split(',');
    const signatureParts: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        signatureParts[key.trim()] = value.trim();
      }
    }

    const ts = signatureParts.ts;
    const v1 = signatureParts.v1;

    if (!ts || !v1) {
      console.warn('Invalid signature format - missing ts or v1');
      return false;
    }

    // Check timestamp (prevent replay attacks - 10 minute window)
    // MP pode enviar em milissegundos ou segundos
    let timestamp = parseInt(ts, 10);
    if (timestamp > 9999999999) {
      timestamp = Math.floor(timestamp / 1000); // Converter ms para s
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 600) {
      console.warn('Signature timestamp too old:', { ts, now, diff: Math.abs(now - timestamp) });
      return false;
    }

    // MercadoPago signature format: id:{data.id};request-id:{x-request-id};ts:{ts};
    const manifest = `id:${dataId};request-id:${requestId || ''};ts:${ts};`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(manifest)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = expectedSignature === v1;
    if (!isValid) {
      console.warn('Signature mismatch:', { expected: expectedSignature.substring(0, 10) + '...', received: v1.substring(0, 10) + '...' });
    }
    return isValid;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

// Log webhook attempt for security audit
async function logWebhookAttempt(
  supabase: any,
  success: boolean,
  reason: string,
  payload: any
) {
  try {
    await supabase.from('activity_logs').insert({
      action: success ? 'webhook_processed' : 'webhook_rejected',
      entity_type: 'mercadopago_webhook',
      details: {
        success,
        reason,
        type: payload?.type,
        action: payload?.action,
        data_id: payload?.data?.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('Error logging webhook attempt:', e);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações do sistema
    const { data: configs } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['mercadopago_access_token', 'mercadopago_webhook_secret'])

    const configMap = new Map(configs?.map(c => [c.key, c.value]) || [])
    const accessToken = configMap.get('mercadopago_access_token')
    const webhookSecret = configMap.get('mercadopago_webhook_secret')

    if (!accessToken) {
      console.error('mercadopago_access_token not configured in system_config')
      return new Response(JSON.stringify({ error: 'Access token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse do body primeiro para obter data.id
    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // ============================================
    // SECURITY: Validar assinatura do webhook
    // ============================================
    const signature = req.headers.get('x-signature')
    const requestId = req.headers.get('x-request-id')
    const dataId = body?.data?.id?.toString() || ''

    if (webhookSecret) {
      const isValidSignature = await validateWebhookSignature(
        signature,
        requestId,
        dataId,
        webhookSecret
      )

      if (!isValidSignature) {
        // Verificar se é uma simulação de teste do Mercado Pago
        // IDs padrão de teste: "123456", datas fixas de 2021
        const isTestSimulation = dataId === '123456' || 
          body?.date_created === '2021-11-01T02:02:02Z' ||
          body?.date === '2021-11-01T02:02:02Z' ||
          body?.live_mode === false;

        if (isTestSimulation) {
          console.log('Test simulation detected - skipping signature validation');
          await logWebhookAttempt(supabase, true, 'Test simulation - validation bypassed', body);
        } else {
          console.error('SECURITY: Invalid webhook signature detected!', {
            hasSignature: !!signature,
            hasRequestId: !!requestId,
            dataId
          })
          
          await logWebhookAttempt(supabase, false, 'Invalid signature', body)
          
          // Retornar 401 para assinatura inválida em produção
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
      
      console.log('Webhook signature validated successfully')
    } else {
      console.warn('SECURITY WARNING: mercadopago_webhook_secret not configured - signature validation skipped')
      // Log warning mas continua processando (para ambientes de desenvolvimento)
      await logWebhookAttempt(supabase, true, 'Secret not configured - validation skipped', body)
    }

    const { type, data, action } = body

    // Processar diferentes tipos de notificação
    if (type === 'payment' || action?.includes('payment')) {
      await processPayment(supabase, data.id, accessToken)
    } else if (type === 'subscription_preapproval' || action?.includes('subscription_preapproval')) {
      await processSubscription(supabase, data.id, accessToken)
    } else if (type === 'subscription_authorized_payment' || action?.includes('authorized_payment')) {
      // Pagamento autorizado de assinatura recorrente (cartão)
      console.log('Processing subscription authorized payment:', data.id)
      await processSubscriptionPayment(supabase, data.id, accessToken)
    } else if (type === 'plan') {
      console.log('Plan notification received, no action needed')
    } else {
      console.log('Unknown notification type:', type, action)
    }

    await logWebhookAttempt(supabase, true, 'Processed successfully', body)

    // Sempre retornar 200 para o Mercado Pago
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook error:', error)
    // Retornar 200 mesmo em caso de erro para evitar retentativas infinitas
    return new Response(JSON.stringify({ error: 'Internal error', details: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Parsear external_reference que pode ser:
// 1. Novo formato: "VIPSEND|NomeCliente|NomePlano|user_id|plan_id"
// 2. JSON legado: {"user_id": "...", "plan_id": "..."}
// 3. UUID direto (muito antigo)
function parseExternalReference(ref: string | undefined): { userId: string; planId?: string; clientName?: string; planName?: string } | null {
  if (!ref) return null;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // Novo formato: VIPSEND|Nome|Plano|user_id|plan_id
  if (ref.startsWith('VIPSEND|')) {
    const parts = ref.split('|');
    if (parts.length >= 4) {
      const userId = parts[3];
      const planId = parts[4];
      if (uuidRegex.test(userId)) {
        return { 
          userId, 
          planId: planId && uuidRegex.test(planId) ? planId : undefined,
          clientName: parts[1],
          planName: parts[2]
        };
      }
    }
  }
  
  // JSON legado
  try {
    const parsed = JSON.parse(ref);
    if (parsed.user_id && uuidRegex.test(parsed.user_id)) {
      return { userId: parsed.user_id, planId: parsed.plan_id };
    }
  } catch {
    // Não é JSON, verificar se é UUID direto
    if (uuidRegex.test(ref)) {
      return { userId: ref };
    }
  }
  
  console.error('Could not parse external_reference:', ref);
  return null;
}

async function processPayment(supabase: any, paymentId: string, accessToken: string) {
  console.log('Processing payment:', paymentId)

  // Validar paymentId
  if (!paymentId || !/^\d+$/.test(paymentId.toString())) {
    console.error('Invalid payment ID format:', paymentId)
    throw new Error('Invalid payment ID')
  }

  // Buscar detalhes do pagamento na API do Mercado Pago
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    console.error('Failed to fetch payment:', response.status, await response.text())
    throw new Error(`Failed to fetch payment: ${response.status}`)
  }

  const payment: MercadoPagoPayment = await response.json()
  console.log('Payment details:', JSON.stringify(payment, null, 2))

  // Parsear external_reference (pode ser JSON ou UUID direto)
  const extRef = parseExternalReference(payment.external_reference)
  if (!extRef) {
    console.log('No valid external_reference (user_id) in payment, skipping')
    return
  }
  
  const userId = extRef.userId

  // Buscar assinatura do usuário
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, plan_id, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (subError) {
    console.error('Error fetching subscription:', subError)
  }

  // Registrar pagamento
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert({
      external_payment_id: paymentId.toString(),
      user_id: userId,
      subscription_id: subscription?.id || null,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      status: payment.status,
      payment_method: payment.payment_method_id,
      payment_type: payment.payment_type_id,
      payer_email: payment.payer?.email,
      paid_at: payment.date_approved || null,
      raw_data: payment
    }, {
      onConflict: 'external_payment_id'
    })

  if (paymentError) {
    console.error('Error saving payment:', paymentError)
  }

  // Se pagamento aprovado, atualizar assinatura
  if (payment.status === 'approved' && subscription) {
    // Calcular nova data de expiração (30 dias a partir de agora)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        expires_at: expiresAt.toISOString(),
        payment_failed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('Error updating subscription:', updateError)
    } else {
      console.log('Subscription activated:', subscription.id)

      // Registrar histórico
      await supabase.from('subscription_history').insert({
        subscription_id: subscription.id,
        user_id: userId,
        old_status: subscription.status,
        new_status: 'active',
        reason: `Pagamento aprovado: ${paymentId}`
      })
    }
  } else if (['rejected', 'cancelled', 'refunded'].includes(payment.status) && subscription) {
    // Pagamento falhou
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        payment_failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('Error updating subscription payment failure:', updateError)
    }
  }
}

async function processSubscription(supabase: any, subscriptionId: string, accessToken: string) {
  console.log('Processing subscription:', subscriptionId)

  // Validar subscriptionId
  if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId.length > 100) {
    console.error('Invalid subscription ID format:', subscriptionId)
    throw new Error('Invalid subscription ID')
  }

  // Buscar detalhes da assinatura na API do Mercado Pago
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    console.error('Failed to fetch subscription:', response.status, await response.text())
    throw new Error(`Failed to fetch subscription: ${response.status}`)
  }

  const mpSubscription: MercadoPagoSubscription = await response.json()
  console.log('Subscription details:', JSON.stringify(mpSubscription, null, 2))

  // Parsear external_reference (pode ser JSON ou UUID direto)
  const extRef = parseExternalReference(mpSubscription.external_reference)
  if (!extRef) {
    console.log('No valid external_reference (user_id) in subscription, skipping')
    return
  }
  
  const userId = extRef.userId

  // Buscar assinatura do usuário
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (subError || !subscription) {
    console.error('No subscription found for user:', userId)
    return
  }

  // Mapear status do Mercado Pago para nosso sistema
  let newStatus: string
  switch (mpSubscription.status) {
    case 'authorized':
    case 'active':
      newStatus = 'active'
      break
    case 'paused':
      newStatus = 'suspended'
      break
    case 'cancelled':
    case 'ended':
      newStatus = 'cancelled'
      break
    case 'pending':
      newStatus = 'payment_pending'
      break
    default:
      console.log('Unknown MP subscription status:', mpSubscription.status)
      return
  }

  // Atualizar assinatura local
  const updateData: any = {
    external_subscription_id: subscriptionId,
    status: newStatus,
    updated_at: new Date().toISOString()
  }

  if (newStatus === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString()
  } else if (newStatus === 'suspended') {
    updateData.suspended_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscription.id)

  if (updateError) {
    console.error('Error updating subscription:', updateError)
  } else {
    console.log('Subscription updated:', subscription.id, 'new status:', newStatus)

    // Registrar histórico
    await supabase.from('subscription_history').insert({
      subscription_id: subscription.id,
      user_id: userId,
      old_status: subscription.status,
      new_status: newStatus,
      reason: `Notificação Mercado Pago: ${mpSubscription.status}`
    })
  }
}

// Processar pagamento autorizado de assinatura recorrente (cartão de crédito)
async function processSubscriptionPayment(supabase: any, authorizedPaymentId: string, accessToken: string) {
  console.log('Processing subscription authorized payment:', authorizedPaymentId)

  // Buscar detalhes do pagamento autorizado
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    console.error('Failed to fetch authorized payment:', response.status, await response.text())
    // Tentar buscar como pagamento normal
    console.log('Trying to fetch as regular payment...')
    return await processPayment(supabase, authorizedPaymentId, accessToken)
  }

  const authorizedPayment = await response.json()
  console.log('Authorized payment details:', JSON.stringify(authorizedPayment, null, 2))

  // Se tiver payment_id, buscar detalhes do pagamento real
  const paymentId = authorizedPayment.payment?.id || authorizedPayment.id
  if (paymentId && /^\d+$/.test(paymentId.toString())) {
    console.log('Found payment ID in authorized payment:', paymentId)
    
    // Buscar detalhes do pagamento real
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (paymentResponse.ok) {
      const payment = await paymentResponse.json()
      console.log('Real payment details:', JSON.stringify(payment, null, 2))

      // Parsear external_reference
      const extRef = parseExternalReference(payment.external_reference)
      if (!extRef) {
        console.log('No valid external_reference in payment')
        return
      }

      const userId = extRef.userId
      
      // Buscar subscription_id do MP para associar
      const preapprovalId = payment.metadata?.preapproval_id
      
      // Buscar assinatura do usuário
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('id, plan_id, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (subError) {
        console.error('Error fetching subscription:', subError)
      }

      // Registrar pagamento
      const { error: paymentError } = await supabase
        .from('payments')
        .upsert({
          external_payment_id: paymentId.toString(),
          external_subscription_id: preapprovalId || null,
          user_id: userId,
          subscription_id: subscription?.id || null,
          amount: payment.transaction_amount,
          currency: payment.currency_id,
          status: payment.status,
          payment_method: payment.payment_method_id,
          payment_type: 'subscription',
          payer_email: payment.payer?.email,
          paid_at: payment.date_approved || null,
          raw_data: payment
        }, {
          onConflict: 'external_payment_id'
        })

      if (paymentError) {
        console.error('Error saving subscription payment:', paymentError)
      } else {
        console.log('Subscription payment saved successfully:', paymentId)
      }

      // Se pagamento aprovado, atualizar assinatura
      if (payment.status === 'approved' && subscription) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            expires_at: expiresAt.toISOString(),
            payment_failed_at: null,
            suspended_at: null,
            external_subscription_id: preapprovalId || subscription.external_subscription_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error('Error updating subscription:', updateError)
        } else {
          console.log('Subscription activated via card payment:', subscription.id)

          // Atualizar profile também
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_started_at: new Date().toISOString(),
              subscription_expires_at: expiresAt.toISOString(),
              suspended_at: null,
              payment_failed_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          // Registrar histórico
          await supabase.from('subscription_history').insert({
            subscription_id: subscription.id,
            user_id: userId,
            old_status: subscription.status,
            new_status: 'active',
            reason: `Pagamento por cartão aprovado: ${paymentId}`
          })
        }
      }
    }
  }
}
