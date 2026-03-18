import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_NAME = "retry-campaign-failed";

interface RetryCampaignRequest {
  campaignId: string;
  groupId?: string;
}

interface CampaignItem {
  id: string;
  item_type: "text" | "media" | "poll";
  text_content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "document" | "audio" | null;
  media_caption: string | null;
  media_filename: string | null;
  poll_question: string | null;
  poll_options: string[] | null;
  poll_allow_multiple: boolean;
  order_index: number;
  delay_after: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function generateExecutionId(): string {
  return `${FUNCTION_NAME}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function getSystemConfig(supabase: any, key: string): Promise<string> {
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();
    
  if (error) return "";
  return data?.value || "";
}

// ============================================
// AUDIT LOGGING
// ============================================
async function logAuditEntry(
  supabase: any,
  params: {
    source: string;
    campaignId?: string;
    groupId?: string;
    itemId?: string;
    instanceId?: string;
    userId?: string;
    instanceName?: string;
    groupWhatsappId?: string;
    messageType?: string;
    messagePreview?: string;
    apiEndpoint?: string;
    requestPayload?: any;
    responsePayload?: any;
    responseStatus?: number;
    wasBlocked?: boolean;
    blockReason?: string;
    callerInfo?: any;
  }
) {
  try {
    await supabase.from("message_audit_log").insert({
      source: params.source,
      function_name: FUNCTION_NAME,
      campaign_id: params.campaignId,
      group_id: params.groupId,
      item_id: params.itemId,
      instance_id: params.instanceId,
      user_id: params.userId,
      instance_name: params.instanceName,
      group_whatsapp_id: params.groupWhatsappId,
      message_type: params.messageType,
      message_preview: params.messagePreview?.substring(0, 200),
      api_endpoint: params.apiEndpoint,
      request_payload: params.requestPayload,
      response_payload: params.responsePayload,
      response_status: params.responseStatus,
      was_blocked: params.wasBlocked || false,
      block_reason: params.blockReason,
      caller_info: params.callerInfo,
    });
  } catch (error) {
    console.error("Error logging audit entry:", error);
  }
}

// ============================================
// CIRCUIT BREAKER - Bloqueia campanhas antigas
// ============================================
function isCampaignTooOld(campaign: any): { tooOld: boolean; reason?: string } {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const TWO_HOURS = 2 * ONE_HOUR;

  if (campaign.completed_at) {
    const completedAt = new Date(campaign.completed_at).getTime();
    if (now - completedAt > ONE_HOUR) {
      return { tooOld: true, reason: `Campanha completada há ${Math.round((now - completedAt) / 60000)} minutos (limite: 60min)` };
    }
  }

  if (campaign.started_at) {
    const startedAt = new Date(campaign.started_at).getTime();
    if (now - startedAt > TWO_HOURS) {
      return { tooOld: true, reason: `Campanha iniciada há ${Math.round((now - startedAt) / 60000)} minutos (limite: 120min)` };
    }
  }

  return { tooOld: false };
}

// ============================================
// VALIDATION
// ============================================
async function validateCampaignForRetry(
  supabase: any,
  campaignId: string,
  userId: string,
  callerInfo: any
): Promise<{ valid: boolean; campaign?: any; reason?: string }> {
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (campaignError || !campaign) {
    await logAuditEntry(supabase, {
      source: "retry-campaign-failed",
      campaignId,
      userId,
      wasBlocked: true,
      blockReason: "Campaign not found or not owned by user",
      callerInfo,
    });
    return { valid: false, reason: "Campanha não encontrada" };
  }

  const validStatuses = ["completed", "running"];
  if (!validStatuses.includes(campaign.status)) {
    console.error(`BLOCKED: Retry for campaign ${campaignId} with invalid status: ${campaign.status}`);
    await logAuditEntry(supabase, {
      source: "retry-campaign-failed",
      campaignId,
      userId,
      wasBlocked: true,
      blockReason: `Invalid campaign status for retry: ${campaign.status}. Valid: ${validStatuses.join(", ")}`,
      callerInfo,
    });
    return { valid: false, reason: `Status inválido para retry: ${campaign.status}` };
  }

  // CIRCUIT BREAKER
  const ageCheck = isCampaignTooOld(campaign);
  if (ageCheck.tooOld) {
    console.error(`CIRCUIT BREAKER: Retry blocked for campaign ${campaignId}: ${ageCheck.reason}`);
    await logAuditEntry(supabase, {
      source: "retry-campaign-failed",
      campaignId,
      userId,
      wasBlocked: true,
      blockReason: `Circuit breaker: ${ageCheck.reason}`,
      callerInfo,
    });
    return { valid: false, reason: `Retry bloqueado: ${ageCheck.reason}` };
  }

  return { valid: true, campaign };
}

async function sendTextMessage(apiUrl: string, apiKey: string, instanceName: string, groupId: string, text: string) {
  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey },
    body: JSON.stringify({ number: groupId, text }),
  });
  return response;
}

async function sendMediaMessage(
  apiUrl: string, apiKey: string, instanceName: string, groupId: string,
  mediaType: string, mediaUrl: string, caption?: string, filename?: string
) {
  const body: any = { number: groupId, mediatype: mediaType, media: mediaUrl };
  if (caption) body.caption = caption;
  if (filename) body.fileName = filename;

  const response = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey },
    body: JSON.stringify(body),
  });
  return response;
}

async function sendPollMessage(
  apiUrl: string, apiKey: string, instanceName: string, groupId: string,
  question: string, options: string[], allowMultiple: boolean
) {
  const response = await fetch(`${apiUrl}/message/sendPoll/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey },
    body: JSON.stringify({
      number: groupId,
      name: question,
      values: options,
      selectableCount: allowMultiple ? options.length : 1,
    }),
  });
  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = generateExecutionId();
  const callerInfo = {
    userAgent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    timestamp: new Date().toISOString(),
    executionId,
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RetryCampaignRequest = await req.json();
    console.log(`[${FUNCTION_NAME}] [${executionId}] Retrying campaign ${body.campaignId} for user ${user.id}${body.groupId ? `, group ${body.groupId}` : ""}`);

    // VALIDATION + CIRCUIT BREAKER
    const validation = await validateCampaignForRetry(supabase, body.campaignId, user.id, callerInfo);
    
    if (!validation.valid) {
      console.error(`[${FUNCTION_NAME}] BLOCKED: ${validation.reason}`);
      return new Response(JSON.stringify({ error: validation.reason }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaign = validation.campaign!;

    // Get failed logs - ONLY truly failed, NOT pending/inconclusive
    let query = supabase
      .from("send_logs")
      .select(`
        id,
        group_id,
        campaign_item_id,
        retry_count,
        api_response,
        error_message,
        groups!inner (id, whatsapp_id, name, instance_id),
        campaign_items!inner (
          id,
          item_type,
          text_content,
          media_url,
          media_type,
          media_caption,
          media_filename,
          poll_question,
          poll_options,
          poll_allow_multiple,
          order_index,
          delay_after
        )
      `)
      .eq("campaign_id", campaign.id)
      .eq("status", "failed");

    if (body.groupId) {
      query = query.eq("group_id", body.groupId);
    }

    const { data: failedLogs, error: logsError } = await query;

    if (logsError) throw logsError;

    if (!failedLogs || failedLogs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Nenhuma mensagem para reenviar",
        retried: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for already-sent logs (idempotency) AND pending logs
    const { data: activeLogsList } = await supabase
      .from("send_logs")
      .select("group_id, campaign_item_id, status")
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "pending"]);

    const sentSet = new Set(
      (activeLogsList || []).filter((l: any) => l.status === "sent").map((l: any) => `${l.group_id}:${l.campaign_item_id}`)
    );
    const pendingSet = new Set(
      (activeLogsList || []).filter((l: any) => l.status === "pending").map((l: any) => `${l.group_id}:${l.campaign_item_id}`)
    );

    const logsToRetry = failedLogs.filter((log: any) => {
      const key = `${log.group_id}:${log.campaign_item_id}`;
      if (sentSet.has(key)) {
        console.log(`Skipping log ${log.id} - already has a "sent" log for same group+item`);
        return false;
      }
      if (pendingSet.has(key)) {
        console.log(`Skipping log ${log.id} - has a "pending" log (still in progress) for same group+item`);
        return false;
      }
      return true;
    });

    const duplicateLogs = failedLogs.filter((log: any) => {
      const key = `${log.group_id}:${log.campaign_item_id}`;
      return sentSet.has(key);
    });

    if (duplicateLogs.length > 0) {
      console.log(`Deleting ${duplicateLogs.length} false positive failure logs`);
      const duplicateIds = duplicateLogs.map((l: any) => l.id);
      await supabase.from("send_logs").delete().in("id", duplicateIds);
    }

    if (logsToRetry.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Todas as falhas eram falsos positivos ou estão em progresso",
        retried: 0,
        falsePositivesRemoved: duplicateLogs.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${executionId}] Found ${logsToRetry.length} genuine failed logs to retry`);

    const globalApiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const globalApiKey = await getSystemConfig(supabase, "evolution_api_key");
    const rateLimitDelay = parseInt(await getSystemConfig(supabase, "evolution_rate_limit_delay") || "2000");

    if (!globalApiUrl || !globalApiKey) {
      throw new Error("Evolution API não configurada");
    }

    let instanceIds: string[] = [];
    const { data: campaignInstances } = await supabase
      .from("campaign_instances")
      .select("instance_id")
      .eq("campaign_id", campaign.id);

    if (campaignInstances && campaignInstances.length > 0) {
      instanceIds = campaignInstances.map(ci => ci.instance_id);
    } else if (campaign.whatsapp_instance_id) {
      instanceIds = [campaign.whatsapp_instance_id];
    }

    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status")
      .in("id", instanceIds)
      .eq("status", "connected");

    if (!instances || instances.length === 0) {
      throw new Error("Nenhuma instância conectada disponível");
    }

    let successCount = 0;
    let failCount = 0;

    for (const log of logsToRetry) {
      const group = log.groups as unknown as { id: string; whatsapp_id: string; name: string; instance_id: string };
      const item = log.campaign_items as unknown as CampaignItem;

      if (!group || !item) {
        console.log(`Skipping log ${log.id}: missing group or item data`);
        failCount++;
        continue;
      }

      const instance = instances[Math.floor(Math.random() * instances.length)];
      
      try {
        let response: Response | null = null;

        // Update the EXISTING failed log to pending before retry
        await supabase.from("send_logs").update({
          status: "pending",
          api_call_started_at: new Date().toISOString(),
          execution_id: executionId,
        }).eq("id", log.id);

        const endpoint = item.item_type === "text" 
          ? `${globalApiUrl}/message/sendText/${instance.instance_name}`
          : item.item_type === "poll"
          ? `${globalApiUrl}/message/sendPoll/${instance.instance_name}`
          : `${globalApiUrl}/message/sendMedia/${instance.instance_name}`;

        switch (item.item_type) {
          case "text":
            if (item.text_content) {
              response = await sendTextMessage(
                globalApiUrl, globalApiKey, instance.instance_name,
                group.whatsapp_id, item.text_content
              );
            }
            break;

          case "media":
            if (item.media_url && item.media_type) {
              response = await sendMediaMessage(
                globalApiUrl, globalApiKey, instance.instance_name,
                group.whatsapp_id, item.media_type, item.media_url,
                item.media_caption || undefined, item.media_filename || undefined
              );
            }
            break;

          case "poll":
            if (item.poll_question && item.poll_options) {
              response = await sendPollMessage(
                globalApiUrl, globalApiKey, instance.instance_name,
                group.whatsapp_id, item.poll_question,
                item.poll_options as string[], item.poll_allow_multiple || false
              );
            }
            break;
        }

        if (response) {
          const responseData = await response.json();
          
          await logAuditEntry(supabase, {
            source: "retry-campaign-failed",
            campaignId: campaign.id,
            groupId: group.id,
            itemId: item.id,
            instanceId: instance.id,
            userId: user.id,
            instanceName: instance.instance_name,
            groupWhatsappId: group.whatsapp_id,
            messageType: item.item_type,
            messagePreview: item.text_content || item.poll_question || `[${item.media_type}]`,
            apiEndpoint: endpoint,
            responsePayload: responseData,
            responseStatus: response.status,
            callerInfo: { executionId },
          });

          await supabase.from("send_logs").update({
            status: response.ok ? "sent" : "failed",
            sent_at: response.ok ? new Date().toISOString() : null,
            error_message: response.ok ? null : (responseData.message || `HTTP ${response.status}`),
            api_response: responseData,
            retry_count: (log as any).retry_count ? (log as any).retry_count + 1 : 1,
            execution_id: executionId,
          }).eq("id", log.id);

          if (response.ok) {
            console.log(`Successfully retried ${item.item_type} to ${group.name}`);
            successCount++;
          } else {
            console.log(`Retry failed for ${group.name}: ${responseData.message}`);
            failCount++;
          }
        }

        await delay(rateLimitDelay);

      } catch (error) {
        console.error(`Error retrying log ${log.id}:`, error);
        
        await supabase.from("send_logs").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Erro desconhecido",
          retry_count: (log as any).retry_count ? (log as any).retry_count + 1 : 1,
          execution_id: executionId,
        }).eq("id", log.id);

        failCount++;
      }
    }

    // Update campaign counts
    const { data: updatedStats } = await supabase
      .from("send_logs")
      .select("status")
      .eq("campaign_id", campaign.id);

    if (updatedStats) {
      const sentCount = updatedStats.filter(s => s.status === "sent").length;
      const failedCount = updatedStats.filter(s => s.status === "failed").length;
      
      await supabase.from("campaigns").update({
        sent_count: sentCount,
        failed_count: failedCount,
      }).eq("id", campaign.id);
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "campaign_retry",
      entity_type: "campaign",
      entity_id: campaign.id,
      details: { 
        success: successCount, 
        failed: failCount,
        group_id: body.groupId || null,
        false_positives_removed: duplicateLogs.length,
        execution_id: executionId,
      },
    });

    console.log(`[${executionId}] Retry complete: ${successCount} success, ${failCount} failed, ${duplicateLogs.length} false positives removed`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Retentativa concluída: ${successCount} enviado(s), ${failCount} falha(s)${duplicateLogs.length > 0 ? `, ${duplicateLogs.length} falso(s) positivo(s) removido(s)` : ""}`,
      retried: successCount,
      failed: failCount,
      falsePositivesRemoved: duplicateLogs.length,
      executionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Retry campaign error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
