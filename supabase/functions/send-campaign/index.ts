import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCampaignRequest {
  campaignId: string;
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

interface InstanceInfo {
  id: string;
  instance_name: string;
  status: string;
  api_url?: string;
  api_key?: string;
}

const FUNCTION_NAME = "send-campaign";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique execution ID for traceability
function generateExecutionId(): string {
  return `${FUNCTION_NAME}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function getSystemConfig(supabase: any, key: string): Promise<string> {
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();
    
  if (error) {
    console.error(`Error fetching config ${key}:`, error);
    return "";
  }
  
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
// IDEMPOTENCY CHECK - Verifica se já foi enviado OU está pendente
// ============================================
async function isAlreadySentOrPending(
  supabase: any,
  campaignId: string,
  itemId: string,
  groupId: string
): Promise<{ blocked: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from("send_logs")
    .select("id, status")
    .eq("campaign_id", campaignId)
    .eq("campaign_item_id", itemId)
    .eq("group_id", groupId)
    .in("status", ["sent", "pending"]);

  if (error) {
    console.error("Error checking idempotency:", error);
    return { blocked: false };
  }

  if (data && data.length > 0) {
    const statuses = data.map((d: any) => d.status);
    if (statuses.includes("sent")) {
      return { blocked: true, reason: "already_sent" };
    }
    if (statuses.includes("pending")) {
      return { blocked: true, reason: "pending_in_progress" };
    }
  }

  return { blocked: false };
}

// ============================================
// VALIDATION
// ============================================
async function validateCampaignForSending(
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
      source: "send-campaign",
      campaignId,
      userId,
      wasBlocked: true,
      blockReason: "Campaign not found or not owned by user",
      callerInfo,
    });
    return { valid: false, reason: "Campanha não encontrada" };
  }

  const validStatuses = ["draft", "scheduled"];
  if (!validStatuses.includes(campaign.status)) {
    console.error(`BLOCKED: Campaign ${campaignId} has invalid status: ${campaign.status}`);
    await logAuditEntry(supabase, {
      source: "send-campaign",
      campaignId,
      userId,
      wasBlocked: true,
      blockReason: `Invalid campaign status: ${campaign.status}. Valid: ${validStatuses.join(", ")}`,
      callerInfo,
    });
    return { valid: false, reason: `Campanha com status inválido: ${campaign.status}` };
  }

  return { valid: true, campaign };
}

function getRandomInstance(instances: InstanceInfo[]): InstanceInfo | null {
  const connected = instances.filter(i => i.status === "connected");
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)];
}

// ============================================
// ATOMIC CAMPAIGN CLAIM - Prevents concurrent execution
// ============================================
async function claimCampaign(
  supabase: any,
  campaignId: string,
  executionId: string,
  fromStatuses: string[]
): Promise<boolean> {
  // Use conditional update: only succeeds if campaign is still in expected status
  const { data, error } = await supabase
    .from("campaigns")
    .update({ 
      status: "running", 
      started_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .in("status", fromStatuses)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[${FUNCTION_NAME}] [CLAIM] ❌ Failed to claim campaign ${campaignId} - already claimed or status changed`);
    return false;
  }

  console.log(`[${FUNCTION_NAME}] [CLAIM] ✅ Campaign ${campaignId} claimed by execution ${executionId}`);
  return true;
}

// ============================================
// INSTANCE LOCK - Prevents two campaigns using same instance
// ============================================
async function acquireInstanceLock(
  supabase: any,
  instanceId: string,
  executionId: string,
  ttlMinutes: number = 30
): Promise<boolean> {
  await supabase.rpc("cleanup_expired_locks");

  const { data: existingLock } = await supabase
    .from("instance_send_lock")
    .select("locked_by, locked_until")
    .eq("instance_id", instanceId)
    .maybeSingle();

  if (existingLock && existingLock.locked_by !== executionId) {
    console.warn(`[${FUNCTION_NAME}] [LOCK] ⛔ Instance ${instanceId} already locked by ${existingLock.locked_by} until ${existingLock.locked_until}`);
    return false;
  }

  const lockedUntil = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("instance_send_lock")
    .upsert({
      instance_id: instanceId,
      locked_by: executionId,
      locked_until: lockedUntil,
    }, { onConflict: "instance_id" });

  if (error) {
    console.error(`[${FUNCTION_NAME}] [LOCK] ❌ Failed to acquire lock on instance ${instanceId}:`, error);
    return false;
  }

  const { data: confirmedLock } = await supabase
    .from("instance_send_lock")
    .select("locked_by")
    .eq("instance_id", instanceId)
    .single();

  if (confirmedLock?.locked_by === executionId) {
    console.log(`[${FUNCTION_NAME}] [LOCK] ✅ Acquired lock on instance ${instanceId}`);
    return true;
  }

  console.warn(`[${FUNCTION_NAME}] [LOCK] ⛔ Instance ${instanceId} confirmation failed; current owner ${confirmedLock?.locked_by}`);
  return false;
}

async function releaseInstanceLock(supabase: any, instanceId: string, executionId: string) {
  await supabase
    .from("instance_send_lock")
    .delete()
    .eq("instance_id", instanceId)
    .eq("locked_by", executionId);
  console.log(`[${FUNCTION_NAME}] [LOCK] Released lock on instance ${instanceId}`);
}

// ============================================
// SINGLE SEND ONLY - no automatic retry to avoid duplicate delivery
// ============================================
async function sendOnce(
  sendFn: () => Promise<{ response: Response; responseData: any }>
): Promise<{ response: Response; responseData: any }> {
  return await sendFn();
}

async function sendTextMessage(
  supabase: any,
  apiUrl: string, 
  apiKey: string, 
  instanceName: string, 
  groupId: string, 
  text: string,
  auditParams: {
    campaignId: string;
    groupDbId: string;
    itemId: string;
    instanceId: string;
    userId: string;
  }
) {
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  const body = { number: groupId, text };
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseData = await response.json().catch(() => null);

  await logAuditEntry(supabase, {
    source: "send-campaign",
    campaignId: auditParams.campaignId,
    groupId: auditParams.groupDbId,
    itemId: auditParams.itemId,
    instanceId: auditParams.instanceId,
    userId: auditParams.userId,
    instanceName,
    groupWhatsappId: groupId,
    messageType: "text",
    messagePreview: text,
    apiEndpoint: endpoint,
    requestPayload: body,
    responsePayload: responseData,
    responseStatus: response.status,
  });

  return { response, responseData };
}

async function sendMediaMessage(
  supabase: any,
  apiUrl: string, 
  apiKey: string, 
  instanceName: string, 
  groupId: string,
  mediaType: string,
  mediaUrl: string,
  caption?: string,
  filename?: string,
  auditParams?: {
    campaignId: string;
    groupDbId: string;
    itemId: string;
    instanceId: string;
    userId: string;
  }
) {
  const mediaTypeMap: Record<string, string> = {
    image: "sendMedia",
    video: "sendMedia", 
    audio: "sendWhatsAppAudio",
    document: "sendMedia",
  };
  
  const endpointPath = mediaTypeMap[mediaType] || "sendMedia";
  const endpoint = `${apiUrl}/message/${endpointPath}/${instanceName}`;

  const body: any = {
    number: groupId,
    mediatype: mediaType,
    media: mediaUrl,
  };

  if (caption) body.caption = caption;
  if (filename) body.fileName = filename;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseData = await response.json().catch(() => null);

  if (auditParams) {
    await logAuditEntry(supabase, {
      source: "send-campaign",
      campaignId: auditParams.campaignId,
      groupId: auditParams.groupDbId,
      itemId: auditParams.itemId,
      instanceId: auditParams.instanceId,
      userId: auditParams.userId,
      instanceName,
      groupWhatsappId: groupId,
      messageType: "media",
      messagePreview: caption || `[${mediaType}] ${mediaUrl.substring(0, 50)}...`,
      apiEndpoint: endpoint,
      requestPayload: body,
      responsePayload: responseData,
      responseStatus: response.status,
    });
  }

  return { response, responseData };
}

async function sendPollMessage(
  supabase: any,
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  groupId: string,
  question: string,
  options: string[],
  allowMultiple: boolean,
  auditParams?: {
    campaignId: string;
    groupDbId: string;
    itemId: string;
    instanceId: string;
    userId: string;
  }
) {
  const endpoint = `${apiUrl}/message/sendPoll/${instanceName}`;
  const body = {
    number: groupId,
    name: question,
    values: options,
    selectableCount: allowMultiple ? options.length : 1,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseData = await response.json().catch(() => null);

  if (auditParams) {
    await logAuditEntry(supabase, {
      source: "send-campaign",
      campaignId: auditParams.campaignId,
      groupId: auditParams.groupDbId,
      itemId: auditParams.itemId,
      instanceId: auditParams.instanceId,
      userId: auditParams.userId,
      instanceName,
      groupWhatsappId: groupId,
      messageType: "poll",
      messagePreview: `[POLL] ${question}`,
      apiEndpoint: endpoint,
      requestPayload: body,
      responsePayload: responseData,
      responseStatus: response.status,
    });
  }

  return { response, responseData };
}

async function checkInstanceStatus(apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
      },
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data?.instance?.state === "open" || data?.state === "open";
  } catch {
    return false;
  }
}

async function createPendingLog(
  supabase: any,
  campaignId: string,
  itemId: string,
  groupId: string,
  executionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("send_logs")
    .insert({
      campaign_id: campaignId,
      campaign_item_id: itemId,
      group_id: groupId,
      status: "pending",
      api_call_started_at: new Date().toISOString(),
      execution_id: executionId,
    })
    .select("id")
    .single();

  if (error) {
    // If unique constraint violation, another execution already claimed this
    if (error.code === "23505") {
      console.log(`[${FUNCTION_NAME}] [IDEMPOTENCY] Duplicate blocked by DB constraint: item ${itemId} group ${groupId}`);
      return null;
    }
    console.error("Error creating pending log:", error);
    return null;
  }
  return data?.id || null;
}

async function updateLogWithResult(
  supabase: any,
  logId: string,
  success: boolean,
  responseData: any,
  errorMessage: string | null
) {
  await supabase
    .from("send_logs")
    .update({
      status: success ? "sent" : "failed",
      sent_at: success ? new Date().toISOString() : null,
      error_message: errorMessage,
      api_response: responseData,
    })
    .eq("id", logId);
}

// ============================================
// VERIFY INSTANCE CONNECTIONS - Apenas verifica conexão SEM restart
// ============================================
async function verifyInstanceConnections(
  supabase: any,
  apiUrl: string,
  apiKey: string,
  instances: InstanceInfo[],
  campaignId: string
): Promise<InstanceInfo[]> {
  console.log(`[${FUNCTION_NAME}] === VERIFY CONNECTIONS === Checking ${instances.length} instances (NO restart)...`);

  const readyInstances: InstanceInfo[] = [];

  for (const inst of instances) {
    const connected = await checkInstanceStatus(apiUrl, apiKey, inst.instance_name);

    if (connected) {
      console.log(`[${FUNCTION_NAME}] [VERIFY] ✅ ${inst.instance_name} is connected - proceeding WITHOUT reconnect`);
      readyInstances.push(inst);
      await supabase.from("whatsapp_instances").update({ status: "connected" }).eq("id", inst.id);
    } else {
      console.warn(`[${FUNCTION_NAME}] [VERIFY] ⛔ ${inst.instance_name} is disconnected - skipping reconnect to avoid replaying old queued messages`);
      await supabase.from("whatsapp_instances").update({ status: "disconnected" }).eq("id", inst.id);
    }
  }

  await logAuditEntry(supabase, {
    source: "send-campaign",
    campaignId,
    wasBlocked: false,
    messageType: "verify_connections",
    messagePreview: `Verified ${instances.length} instances, ${readyInstances.length} ready (NO restart)`,
    callerInfo: {
      action: "pre_campaign_verify",
      instances_checked: instances.map(i => i.instance_name),
      instances_ready: readyInstances.map(i => i.instance_name),
    },
  });

  console.log(`[${FUNCTION_NAME}] [VERIFY] === COMPLETE === ${readyInstances.length}/${instances.length} instances ready`);
  return readyInstances;
}

// ============================================
// VERIFY CAMPAIGN INTEGRITY - AUDIT ONLY, NO RESENDING
// Marks missing/pending as failed with clear reason
// ============================================
async function verifyCampaignIntegrity(
  supabase: any,
  campaignId: string,
  items: CampaignItem[],
  groups: any[],
  executionId: string
): Promise<{ realSentCount: number; realFailedCount: number }> {
  console.log(`[${FUNCTION_NAME}] [INTEGRITY] === Starting AUDIT-ONLY integrity check for campaign ${campaignId} ===`);
  console.log(`[${FUNCTION_NAME}] [INTEGRITY] Expected: ${items.length} items × ${groups.length} groups = ${items.length * groups.length} total sends`);

  // 1. Fetch all existing send_logs
  const { data: existingLogs, error: logsError } = await supabase
    .from("send_logs")
    .select("campaign_item_id, group_id, status")
    .eq("campaign_id", campaignId);

  if (logsError) {
    console.error(`[${FUNCTION_NAME}] [INTEGRITY] Error fetching logs:`, logsError);
    const { count: sentCount } = await supabase
      .from("send_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "sent");
    const { count: failedCount } = await supabase
      .from("send_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "failed");
    return { realSentCount: sentCount || 0, realFailedCount: failedCount || 0 };
  }

  // 2. Create map of existing logs
  const logMap = new Map<string, string>();
  for (const log of (existingLogs || [])) {
    const key = `${log.campaign_item_id}:${log.group_id}`;
    const existing = logMap.get(key);
    if (!existing || log.status === "sent" || (log.status === "failed" && existing === "pending")) {
      logMap.set(key, log.status);
    }
  }

  // 3. Find missing combinations - MARK AS FAILED, DO NOT RESEND
  let missingCount = 0;
  let pendingConsolidated = 0;

  for (const group of groups) {
    const groupData = group.groups || group;
    if (!groupData || !groupData.id) continue;

    for (const item of items) {
      const key = `${item.id}:${groupData.id}`;
      const existingStatus = logMap.get(key);

      if (existingStatus === "sent") continue;
      if (existingStatus === "failed") continue;

      if (existingStatus === "pending") {
        // Pending log exists but never resolved - mark as failed (possible timeout)
        console.log(`[${FUNCTION_NAME}] [INTEGRITY] ⚠️ PENDING consolidated to FAILED: item ${item.id} → group ${groupData.name || groupData.id} (possible timeout - may have been delivered)`);
        await supabase
          .from("send_logs")
          .update({
            status: "failed",
            error_message: `Inconclusivo: status ficou pendente após timeout da execução ${executionId}. Pode ter sido entregue. Use retry manual para reenviar se necessário.`,
          })
          .eq("campaign_id", campaignId)
          .eq("campaign_item_id", item.id)
          .eq("group_id", groupData.id)
          .eq("status", "pending");
        pendingConsolidated++;
      } else {
        // No log at all - create a failed log
        missingCount++;
        console.log(`[${FUNCTION_NAME}] [INTEGRITY] ⚠️ MISSING marked as FAILED: item ${item.id} → group ${groupData.name || groupData.id}`);
        await supabase.from("send_logs").insert({
          campaign_id: campaignId,
          campaign_item_id: item.id,
          group_id: groupData.id,
          status: "failed",
          error_message: `Não enviado: item faltante detectado na verificação de integridade (execução ${executionId}). Use retry manual para reenviar.`,
          execution_id: executionId,
        });
      }
    }
  }

  // 4. Recalculate real counts
  const { count: realSentCount } = await supabase
    .from("send_logs")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "sent");

  const { count: realFailedCount } = await supabase
    .from("send_logs")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  console.log(`[${FUNCTION_NAME}] [INTEGRITY] === AUDIT COMPLETE === Missing: ${missingCount}, Pending→Failed: ${pendingConsolidated} (NO auto-resend)`);
  console.log(`[${FUNCTION_NAME}] [INTEGRITY] Final counts - Sent: ${realSentCount || 0}, Failed: ${realFailedCount || 0}`);

  return { realSentCount: realSentCount || 0, realFailedCount: realFailedCount || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
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

    const body: SendCampaignRequest = await req.json();
    console.log(`[${FUNCTION_NAME}] [${executionId}] Starting campaign ${body.campaignId} for user ${user.id}`);

    const validation = await validateCampaignForSending(supabase, body.campaignId, user.id, callerInfo);
    
    if (!validation.valid) {
      console.error(`[${FUNCTION_NAME}] BLOCKED: ${validation.reason}`);
      return new Response(JSON.stringify({ error: validation.reason }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaign = validation.campaign!;

    // ============================================
    // ATOMIC CLAIM - Prevent concurrent execution
    // ============================================
    const claimed = await claimCampaign(supabase, campaign.id, executionId, ["draft", "scheduled"]);
    if (!claimed) {
      console.error(`[${FUNCTION_NAME}] [${executionId}] Campaign ${campaign.id} already claimed by another execution`);
      await logAuditEntry(supabase, {
        source: "send-campaign",
        campaignId: campaign.id,
        userId: user.id,
        wasBlocked: true,
        blockReason: "Campaign already claimed by another execution (atomic claim failed)",
        callerInfo,
      });
      return new Response(JSON.stringify({ error: "Campanha já está sendo processada por outra execução" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign items sorted by order
    const { data: campaignItems, error: itemsError } = await supabase
      .from("campaign_items")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("order_index", { ascending: true });

    if (itemsError) {
      throw new Error("Erro ao buscar itens da campanha");
    }

    const items: CampaignItem[] = campaignItems || [];
    console.log(`Campaign has ${items.length} items`);

    // Get campaign groups
    const { data: campaignGroups, error: groupsError } = await supabase
      .from("campaign_groups")
      .select(`
        *,
        groups (
          id,
          whatsapp_id,
          name,
          instance_id
        )
      `)
      .eq("campaign_id", campaign.id);

    if (groupsError) {
      throw new Error("Erro ao buscar grupos da campanha");
    }

    if (!campaignGroups?.length) {
      throw new Error("Nenhum grupo selecionado para a campanha");
    }

    console.log(`Campaign targets ${campaignGroups.length} groups`);

    // Update total_recipients
    await supabase
      .from("campaigns")
      .update({ total_recipients: campaignGroups.length })
      .eq("id", campaign.id);

    // Get campaign instances
    let campaignInstanceIds: string[] = [];
    
    const { data: campaignInstancesData } = await supabase
      .from("campaign_instances")
      .select("instance_id")
      .eq("campaign_id", campaign.id);
    
    if (campaignInstancesData && campaignInstancesData.length > 0) {
      campaignInstanceIds = campaignInstancesData.map(ci => ci.instance_id);
    } else if (campaign.whatsapp_instance_id) {
      campaignInstanceIds = [campaign.whatsapp_instance_id];
    }

    if (campaignInstanceIds.length === 0) {
      throw new Error("Nenhuma instância WhatsApp configurada para esta campanha");
    }

    const { data: instancesData, error: instancesError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status")
      .in("id", campaignInstanceIds);

    if (instancesError || !instancesData?.length) {
      throw new Error("Erro ao buscar instâncias WhatsApp");
    }

    const instances: InstanceInfo[] = instancesData;
    console.log(`Campaign uses ${instances.length} instances: ${instances.map(i => i.instance_name).join(", ")}`);

    const delayBetweenItems = (campaign.delay_between_items || 2) * 1000;
    const delayBetweenGroups = (campaign.delay_between_groups || 3) * 1000;
    
    const globalApiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const globalApiKey = await getSystemConfig(supabase, "evolution_api_key");
    const rateLimitDelay = parseInt(await getSystemConfig(supabase, "evolution_rate_limit_delay") || "2000");
    
    if (!globalApiUrl || !globalApiKey) {
      throw new Error("Evolution API não configurada. Contate o administrador.");
    }

    const connectedInstances = instances.filter(i => i.status === "connected");
    if (connectedInstances.length === 0) {
      throw new Error("Nenhuma instância conectada. Conecte pelo menos uma instância antes de iniciar a campanha.");
    }

    // VERIFY CONNECTIONS PRE-CAMPANHA
    console.log(`[${FUNCTION_NAME}] Verifying connections for ${connectedInstances.length} instances (NO restart)...`);
    const readyInstances = await verifyInstanceConnections(supabase, globalApiUrl, globalApiKey, connectedInstances, campaign.id);
    
    if (readyInstances.length === 0) {
      throw new Error("Nenhuma instância conectada. Conecte pelo menos uma instância antes de iniciar a campanha.");
    }

    // ============================================
    // ACQUIRE INSTANCE LOCKS
    // ============================================
    const lockedInstances: InstanceInfo[] = [];
    for (const inst of readyInstances) {
      const locked = await acquireInstanceLock(supabase, inst.id, executionId);
      if (locked) {
        lockedInstances.push(inst);
      }
    }

    if (lockedInstances.length === 0) {
      throw new Error("Todas as instâncias estão em uso por outra campanha. Tente novamente em alguns minutos.");
    }

    // Update instance list to only use locked ones
    const lockedInstanceIds = new Set(lockedInstances.map(i => i.id));
    for (const inst of instances) {
      if (!lockedInstanceIds.has(inst.id)) {
        inst.status = "disconnected";
      }
    }

    console.log(`[${FUNCTION_NAME}] ${lockedInstances.length}/${readyInstances.length} instances locked and ready`);

    let sentCount = 0;
    let failedCount = 0;
    
    const instanceFailures: Record<string, number> = {};
    const MAX_FAILURES_BEFORE_SKIP = 3;
    const usedInstanceNames = new Set<string>();

    const shuffledGroups = [...campaignGroups].sort(() => Math.random() - 0.5);

    const MID_CHECK_INTERVAL = 5; // Check campaign status every N groups

    try {
      for (let groupIndex = 0; groupIndex < shuffledGroups.length; groupIndex++) {
        // MID-EXECUTION CHECK: abort if campaign was cancelled/completed externally
        if (groupIndex > 0 && groupIndex % MID_CHECK_INTERVAL === 0) {
          const { data: freshCampaign } = await supabase
            .from("campaigns")
            .select("status")
            .eq("id", campaign.id)
            .single();
          if (freshCampaign && freshCampaign.status !== "running") {
            console.warn(`[${FUNCTION_NAME}] [MID-CHECK] ⛔ Campaign ${campaign.id} status changed to '${freshCampaign.status}' externally — ABORTING execution ${executionId}`);
            await logAuditEntry(supabase, {
              source: "send-campaign",
              campaignId: campaign.id,
              userId: user.id,
              wasBlocked: true,
              blockReason: `Mid-execution abort: status changed to ${freshCampaign.status} (checked at group ${groupIndex}/${shuffledGroups.length})`,
            });
            break;
          }
        }

        const cg = shuffledGroups[groupIndex];
        const group = cg.groups;

        if (!group) {
          console.log(`Skipping invalid group reference`);
          failedCount++;
          continue;
        }

        let selectedInstance: InstanceInfo | null = null;
        let instanceAttempts = 0;
        const maxAttempts = instances.length;

        while (!selectedInstance && instanceAttempts < maxAttempts) {
          const availableInstances = instances.filter(i => 
            i.status === "connected" && 
            lockedInstanceIds.has(i.id) &&
            (instanceFailures[i.id] || 0) < MAX_FAILURES_BEFORE_SKIP &&
            (group.instance_id ? i.id === group.instance_id : true)
          );

          if (availableInstances.length === 0) {
            console.log("All instances have exceeded failure threshold, resetting counters");
            Object.keys(instanceFailures).forEach(k => instanceFailures[k] = 0);
            instanceAttempts++;
            continue;
          }

          selectedInstance = getRandomInstance(availableInstances);
          
          if (selectedInstance) {
            const isConnected = await checkInstanceStatus(globalApiUrl, globalApiKey, selectedInstance.instance_name);
            if (!isConnected) {
              console.log(`Instance ${selectedInstance.instance_name} failed health check, updating status`);
              await supabase
                .from("whatsapp_instances")
                .update({ status: "disconnected" })
                .eq("id", selectedInstance.id);
              
              instanceFailures[selectedInstance.id] = MAX_FAILURES_BEFORE_SKIP;
              selectedInstance.status = "disconnected";
              selectedInstance = null;
            }
          }
          
          instanceAttempts++;
        }

        if (!selectedInstance) {
          console.log(`No available instance for group ${group.name}`);
          
          for (const item of items) {
            await supabase.from("send_logs").insert({
              campaign_id: campaign.id,
              campaign_item_id: item.id,
              group_id: group.id,
              status: "failed",
              error_message: "Nenhuma instância disponível",
              execution_id: executionId,
            });
          }
          
          failedCount++;
          continue;
        }

        usedInstanceNames.add(selectedInstance.instance_name);
        console.log(`Sending to ${group.name} via instance ${selectedInstance.instance_name}`);

        let groupSuccess = true;

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const item = items[itemIndex];
          let errorMessage: string | null = null;
          let logId: string | null = null;

          try {
            // IDEMPOTENCY CHECK - Skip if already sent OR pending
            const idempotencyCheck = await isAlreadySentOrPending(supabase, campaign.id, item.id, group.id);
            if (idempotencyCheck.blocked) {
              console.log(`[IDEMPOTENCY] Skipping item ${item.id} for group ${group.name} - ${idempotencyCheck.reason}`);
              await logAuditEntry(supabase, {
                source: "send-campaign",
                campaignId: campaign.id,
                groupId: group.id,
                itemId: item.id,
                userId: user.id,
                wasBlocked: true,
                blockReason: `Idempotency: ${idempotencyCheck.reason}`,
              });
              continue;
            }

            console.log(`Sending item ${itemIndex + 1}/${items.length} (${item.item_type}) to ${group.name} via ${selectedInstance.instance_name}`);

            logId = await createPendingLog(supabase, campaign.id, item.id, group.id, executionId);
            
            // If createPendingLog returns null due to unique constraint, skip
            if (!logId) {
              console.log(`[IDEMPOTENCY] DB constraint blocked duplicate for item ${item.id} group ${group.id}`);
              continue;
            }

            const auditParams = {
              campaignId: campaign.id,
              groupDbId: group.id,
              itemId: item.id,
              instanceId: selectedInstance.id,
              userId: user.id,
            };

            const sendFn = async () => {
              switch (item.item_type) {
                case "text":
                  if (item.text_content) {
                    return await sendTextMessage(
                      supabase, globalApiUrl, globalApiKey,
                      selectedInstance!.instance_name, group.whatsapp_id,
                      item.text_content, auditParams
                    );
                  }
                  break;

                case "media":
                  if (item.media_url && item.media_type) {
                    return await sendMediaMessage(
                      supabase, globalApiUrl, globalApiKey,
                      selectedInstance!.instance_name, group.whatsapp_id,
                      item.media_type, item.media_url,
                      item.media_caption || undefined,
                      item.media_filename || undefined,
                      auditParams
                    );
                  }
                  break;

                case "poll":
                  if (item.poll_question && item.poll_options) {
                    return await sendPollMessage(
                      supabase, globalApiUrl, globalApiKey,
                      selectedInstance!.instance_name, group.whatsapp_id,
                      item.poll_question, item.poll_options as string[],
                      item.poll_allow_multiple || false, auditParams
                    );
                  }
                  break;
              }
              throw new Error("Item inválido ou vazio");
            };

            let sendResult: { response: Response; responseData: any } | null = null;

            try {
              sendResult = await sendOnce(sendFn);
            } catch (retryError) {
              errorMessage = retryError instanceof Error ? retryError.message : "Erro no envio";
              groupSuccess = false;
              if (logId) {
                await updateLogWithResult(supabase, logId, false, null, errorMessage);
              }
              instanceFailures[selectedInstance.id] = (instanceFailures[selectedInstance.id] || 0) + 1;
              continue;
            }

            if (sendResult) {
              const { response, responseData } = sendResult;
              
              if (!response.ok) {
                errorMessage = responseData?.message || `HTTP ${response.status}`;
                console.error(`Failed to send item to ${group.name}:`, responseData);
                instanceFailures[selectedInstance.id] = (instanceFailures[selectedInstance.id] || 0) + 1;
              } else {
                console.log(`Item sent successfully to ${group.name}`);
                instanceFailures[selectedInstance.id] = 0;
              }

              if (logId) {
                await updateLogWithResult(supabase, logId, response.ok, responseData, errorMessage);
              }

              if (!response.ok) {
                groupSuccess = false;
              }
            } else if (logId) {
              await updateLogWithResult(supabase, logId, false, null, "Item inválido ou vazio");
            }

          } catch (error) {
            console.error(`Error sending item to ${group.name}:`, error);
            errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
            groupSuccess = false;

            instanceFailures[selectedInstance.id] = (instanceFailures[selectedInstance.id] || 0) + 1;

            if (logId) {
              await updateLogWithResult(supabase, logId, false, null, errorMessage);
            } else {
              await supabase.from("send_logs").insert({
                campaign_id: campaign.id,
                campaign_item_id: item.id,
                group_id: group.id,
                status: "failed",
                error_message: errorMessage,
                execution_id: executionId,
              });
            }
          }

          // Delay between items
          const itemDelay = item.delay_after ? item.delay_after * 1000 : delayBetweenItems;
          if (itemIndex < items.length - 1) {
            console.log(`Waiting ${itemDelay}ms before next item...`);
            await delay(Math.max(itemDelay, rateLimitDelay));
          }
        }

        if (groupSuccess) {
          sentCount++;
        } else {
          failedCount++;
        }

        if (groupIndex < shuffledGroups.length - 1) {
          console.log(`Waiting ${delayBetweenGroups}ms before next group...`);
          await delay(Math.max(delayBetweenGroups, rateLimitDelay));
        }
      }
    } finally {
      // ============================================
      // ALWAYS RELEASE INSTANCE LOCKS
      // ============================================
      for (const inst of lockedInstances) {
        await releaseInstanceLock(supabase, inst.id, executionId);
      }
    }

    // ============================================
    // INTEGRITY CHECK - AUDIT ONLY, NO RESENDING
    // ============================================
    console.log(`[${FUNCTION_NAME}] Running post-campaign integrity check (audit only, no resend)...`);
    const { realSentCount, realFailedCount } = await verifyCampaignIntegrity(
      supabase, campaign.id, items, campaignGroups, executionId
    );

    // Update campaign with REAL counts from send_logs
    await supabase
      .from("campaigns")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString(),
        sent_count: realSentCount,
        failed_count: realFailedCount
      })
      .eq("id", campaign.id);

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "campaign_completed",
      entity_type: "campaign",
      entity_id: campaign.id,
      details: { 
        sent: realSentCount, 
        failed: realFailedCount,
        total_items: items.length,
        total_groups: campaignGroups.length,
        instances_used: [...usedInstanceNames],
        duration_ms: Date.now() - startTime,
        execution_id: executionId,
        integrity_check: "audit_only",
      }
    });

    console.log(`[${FUNCTION_NAME}] [${executionId}] Campaign ${campaign.id} completed: ${realSentCount} sent, ${realFailedCount} failed (${Date.now() - startTime}ms)`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: realSentCount, 
      failed: realFailedCount,
      totalItems: items.length,
      instancesUsed: lockedInstances.length,
      executionId,
      message: `Campanha concluída: ${realSentCount} enviados com sucesso, ${realFailedCount} falhas`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send campaign error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
