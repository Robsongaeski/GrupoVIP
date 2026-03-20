import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_NAME = "process-scheduled-campaigns";

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
    
  if (error) {
    console.error(`Error fetching config ${key}:`, error);
    return "";
  }
  
  return data?.value || "";
}

function getRandomInstance(instances: InstanceInfo[]): InstanceInfo | null {
  const connected = instances.filter(i => i.status === "connected");
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)];
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
// IDEMPOTENCY CHECK - blocks on sent OR pending
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
    if (statuses.includes("sent")) return { blocked: true, reason: "already_sent" };
    if (statuses.includes("pending")) return { blocked: true, reason: "pending_in_progress" };
  }

  return { blocked: false };
}

// ============================================
// CIRCUIT BREAKER
// ============================================
function isCampaignTooOld(campaign: any): { tooOld: boolean; reason?: string } {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;
  const ONE_HOUR = 60 * 60 * 1000;

  if (campaign.completed_at) {
    const completedAt = new Date(campaign.completed_at).getTime();
    if (now - completedAt > THIRTY_MINUTES) {
      return { tooOld: true, reason: `Campaign completed ${Math.round((now - completedAt) / 60000)} minutes ago (limit: 30min)` };
    }
  }

  if (campaign.started_at) {
    const startedAt = new Date(campaign.started_at).getTime();
    if (now - startedAt > ONE_HOUR) {
      return { tooOld: true, reason: `Campaign started ${Math.round((now - startedAt) / 60000)} minutes ago (limit: 60min)` };
    }
  }

  if (campaign.scheduled_at) {
    const scheduledAt = new Date(campaign.scheduled_at).getTime();
    if (now - scheduledAt > ONE_HOUR * 2) {
      return { tooOld: true, reason: `Campaign scheduled for ${Math.round((now - scheduledAt) / 60000)} minutes ago (limit: 120min expire)` };
    }
  }

  return { tooOld: false };
}

// ============================================
// ATOMIC CAMPAIGN CLAIM
// ============================================
async function claimCampaign(
  supabase: any,
  campaignId: string,
  executionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("campaigns")
    .update({ 
      status: "running", 
      started_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "scheduled")
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[${FUNCTION_NAME}] [CLAIM] ❌ Failed to claim campaign ${campaignId} (execution ${executionId})`);
    return false;
  }

  console.log(`[${FUNCTION_NAME}] [CLAIM] ✅ Campaign ${campaignId} claimed by ${executionId}`);
  return true;
}

// ============================================
// INSTANCE LOCK
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
}

async function sendTextMessage(apiUrl: string, apiKey: string, instanceName: string, groupId: string, text: string) {
  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: groupId,
      text: text,
    }),
  });
  const responseData = await response.json().catch(() => null);
  return { response, responseData };
}

async function sendMediaMessage(
  apiUrl: string, 
  apiKey: string, 
  instanceName: string, 
  groupId: string,
  mediaType: string,
  mediaUrl: string,
  caption?: string,
  filename?: string
) {
  const mediaTypeMap: Record<string, string> = {
    image: "sendMedia",
    video: "sendMedia", 
    audio: "sendWhatsAppAudio",
    document: "sendMedia",
  };
  
  const endpoint = mediaTypeMap[mediaType] || "sendMedia";

  const body: any = {
    number: groupId,
    mediatype: mediaType,
    media: mediaUrl,
  };

  if (caption) body.caption = caption;
  if (filename) body.fileName = filename;

  const response = await fetch(`${apiUrl}/message/${endpoint}/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify(body),
  });
  const responseData = await response.json().catch(() => null);
  return { response, responseData };
}

async function sendPollMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  groupId: string,
  question: string,
  options: string[],
  allowMultiple: boolean
) {
  const response = await fetch(`${apiUrl}/message/sendPoll/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: groupId,
      name: question,
      values: options,
      selectableCount: allowMultiple ? options.length : 1,
    }),
  });
  const responseData = await response.json().catch(() => null);
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
    if (error.code === "23505") {
      console.log(`[${FUNCTION_NAME}] [IDEMPOTENCY] DB constraint blocked duplicate: item ${itemId} group ${groupId}`);
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
// VERIFY INSTANCE CONNECTIONS - SEM restart
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
    source: "process-scheduled",
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
// SINGLE SEND ONLY - no automatic retry to avoid duplicate delivery
// ============================================
async function sendOnce(
  sendFn: () => Promise<{ response: Response; responseData: any }>
): Promise<{ response: Response; responseData: any }> {
  return await sendFn();
}

// ============================================
// VERIFY CAMPAIGN INTEGRITY - AUDIT ONLY, NO RESENDING
// ============================================
async function verifyCampaignIntegrity(
  supabase: any,
  campaignId: string,
  items: CampaignItem[],
  groups: any[],
  executionId: string
): Promise<{ realSentCount: number; realFailedCount: number }> {
  console.log(`[${FUNCTION_NAME}] [INTEGRITY] === AUDIT-ONLY integrity check for campaign ${campaignId} ===`);

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

  const logMap = new Map<string, string>();
  for (const log of (existingLogs || [])) {
    const key = `${log.campaign_item_id}:${log.group_id}`;
    const existing = logMap.get(key);
    if (!existing || log.status === "sent" || (log.status === "failed" && existing === "pending")) {
      logMap.set(key, log.status);
    }
  }

  let missingCount = 0;
  let pendingConsolidated = 0;

  for (const group of groups) {
    const groupData = group.groups || group;
    if (!groupData || !groupData.id) continue;

    for (const item of items) {
      const key = `${item.id}:${groupData.id}`;
      const existingStatus = logMap.get(key);

      if (existingStatus === "sent" || existingStatus === "failed") continue;

      if (existingStatus === "pending") {
        console.log(`[${FUNCTION_NAME}] [INTEGRITY] ⚠️ PENDING → FAILED: item ${item.id} → group ${groupData.name || groupData.id}`);
        await supabase
          .from("send_logs")
          .update({
            status: "failed",
            error_message: `Inconclusivo: pendente após timeout (execução ${executionId}). Pode ter sido entregue. Use retry manual.`,
          })
          .eq("campaign_id", campaignId)
          .eq("campaign_item_id", item.id)
          .eq("group_id", groupData.id)
          .eq("status", "pending");
        pendingConsolidated++;
      } else {
        missingCount++;
        console.log(`[${FUNCTION_NAME}] [INTEGRITY] ⚠️ MISSING → FAILED: item ${item.id} → group ${groupData.name || groupData.id}`);
        await supabase.from("send_logs").insert({
          campaign_id: campaignId,
          campaign_item_id: item.id,
          group_id: groupData.id,
          status: "failed",
          error_message: `Não enviado: faltante na integridade (execução ${executionId}). Use retry manual.`,
          execution_id: executionId,
        });
      }
    }
  }

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
  return { realSentCount: realSentCount || 0, realFailedCount: realFailedCount || 0 };
}

async function processCampaign(supabase: any, campaign: any, globalApiUrl: string, globalApiKey: string) {
  const executionId = generateExecutionId();
  console.log(`[${FUNCTION_NAME}] [${executionId}] Processing scheduled campaign: ${campaign.id} - ${campaign.name}`);
  
  try {
    // Validate status
    if (campaign.status !== "scheduled") {
      console.error(`[${FUNCTION_NAME}] BLOCKED: Campaign ${campaign.id} has status ${campaign.status}, expected scheduled`);
      await logAuditEntry(supabase, {
        source: "process-scheduled",
        campaignId: campaign.id,
        userId: campaign.user_id,
        wasBlocked: true,
        blockReason: `Invalid status: ${campaign.status}`,
      });
      return { success: false, error: `Status inválido: ${campaign.status}`, blocked: true };
    }

    const ageCheck = isCampaignTooOld(campaign);
    if (ageCheck.tooOld) {
      console.error(`[${FUNCTION_NAME}] CIRCUIT BREAKER: Campaign ${campaign.id} is too old: ${ageCheck.reason}`);
      await logAuditEntry(supabase, {
        source: "process-scheduled",
        campaignId: campaign.id,
        userId: campaign.user_id,
        wasBlocked: true,
        blockReason: `Circuit breaker: ${ageCheck.reason}`,
      });
      return { success: false, error: ageCheck.reason, blocked: true };
    }

    // ============================================
    // ATOMIC CLAIM - Prevent concurrent execution
    // ============================================
    const claimed = await claimCampaign(supabase, campaign.id, executionId);
    if (!claimed) {
      console.error(`[${FUNCTION_NAME}] [${executionId}] Campaign ${campaign.id} already claimed`);
      await logAuditEntry(supabase, {
        source: "process-scheduled",
        campaignId: campaign.id,
        userId: campaign.user_id,
        wasBlocked: true,
        blockReason: `Atomic claim failed - campaign already processing (execution ${executionId})`,
      });
      return { success: false, error: "Campaign already being processed", blocked: true };
    }

    // Get campaign items
    const { data: campaignItems, error: itemsError } = await supabase
      .from("campaign_items")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("order_index", { ascending: true });

    if (itemsError) throw new Error("Erro ao buscar itens da campanha");

    const items: CampaignItem[] = campaignItems || [];
    if (items.length === 0) throw new Error("Campanha sem itens para enviar");

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

    if (groupsError) throw new Error("Erro ao buscar grupos da campanha");
    if (!campaignGroups?.length) throw new Error("Nenhum grupo selecionado para a campanha");

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
      campaignInstanceIds = campaignInstancesData.map((ci: any) => ci.instance_id);
    } else if (campaign.whatsapp_instance_id) {
      campaignInstanceIds = [campaign.whatsapp_instance_id];
    }

    if (campaignInstanceIds.length === 0) throw new Error("Nenhuma instância WhatsApp configurada");

    const { data: instancesData, error: instancesError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status")
      .in("id", campaignInstanceIds);

    if (instancesError || !instancesData?.length) throw new Error("Erro ao buscar instâncias WhatsApp");

    const instances: InstanceInfo[] = instancesData;
    
    const connectedInstances = instances.filter(i => i.status === "connected");
    if (connectedInstances.length === 0) throw new Error("Nenhuma instância conectada");

    // VERIFY CONNECTIONS
    const readyInstances = await verifyInstanceConnections(supabase, globalApiUrl, globalApiKey, connectedInstances, campaign.id);
    if (readyInstances.length === 0) throw new Error("Nenhuma instância conectada para enviar campanha");

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

    if (lockedInstances.length === 0) throw new Error("Todas as instâncias estão em uso por outra campanha");

    const lockedInstanceIds = new Set(lockedInstances.map(i => i.id));
    for (const inst of instances) {
      if (!lockedInstanceIds.has(inst.id)) {
        inst.status = "disconnected";
      }
    }

    console.log(`[${FUNCTION_NAME}] ${lockedInstances.length}/${readyInstances.length} instances locked and ready`);

    const delayBetweenItems = (campaign.delay_between_items || 2) * 1000;
    const delayBetweenGroups = (campaign.delay_between_groups || 3) * 1000;

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
              source: "process-scheduled",
              campaignId: campaign.id,
              userId: campaign.user_id,
              wasBlocked: true,
              blockReason: `Mid-execution abort: status changed to ${freshCampaign.status} (checked at group ${groupIndex}/${shuffledGroups.length})`,
            });
            break;
          }
        }

        const cg = shuffledGroups[groupIndex];
        const group = cg.groups;

        if (!group) {
          failedCount++;
          continue;
        }

        let selectedInstance: InstanceInfo | null = null;
        let instanceAttempts = 0;

        while (!selectedInstance && instanceAttempts < instances.length) {
          const availableInstances = instances.filter(i => 
            i.status === "connected" && 
            lockedInstanceIds.has(i.id) &&
            (instanceFailures[i.id] || 0) < MAX_FAILURES_BEFORE_SKIP &&
            (group.instance_id ? i.id === group.instance_id : true)
          );

          if (availableInstances.length === 0) {
            Object.keys(instanceFailures).forEach(k => instanceFailures[k] = 0);
            instanceAttempts++;
            continue;
          }

          selectedInstance = getRandomInstance(availableInstances);
          
          if (selectedInstance) {
            const isConnected = await checkInstanceStatus(globalApiUrl, globalApiKey, selectedInstance.instance_name);
            if (!isConnected) {
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
        console.log(`Sending to ${group.name} via ${selectedInstance.instance_name}`);

        let groupSuccess = true;

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const item = items[itemIndex];
          let errorMessage: string | null = null;
          let logId: string | null = null;

          try {
            // IDEMPOTENCY - block on sent OR pending
            const idempotencyCheck = await isAlreadySentOrPending(supabase, campaign.id, item.id, group.id);
            if (idempotencyCheck.blocked) {
              console.log(`[IDEMPOTENCY] Skipping item ${item.id} for group ${group.name} - ${idempotencyCheck.reason}`);
              await logAuditEntry(supabase, {
                source: "process-scheduled",
                campaignId: campaign.id,
                groupId: group.id,
                itemId: item.id,
                userId: campaign.user_id,
                wasBlocked: true,
                blockReason: `Idempotency: ${idempotencyCheck.reason}`,
              });
              continue;
            }

            logId = await createPendingLog(supabase, campaign.id, item.id, group.id, executionId);
            
            if (!logId) {
              console.log(`[IDEMPOTENCY] DB constraint blocked duplicate for item ${item.id} group ${group.id}`);
              continue;
            }

            const sendFn = async () => {
              switch (item.item_type) {
                case "text":
                  if (item.text_content) {
                    return await sendTextMessage(globalApiUrl, globalApiKey, selectedInstance!.instance_name, group.whatsapp_id, item.text_content);
                  }
                  break;
                case "media":
                  if (item.media_url && item.media_type) {
                    return await sendMediaMessage(globalApiUrl, globalApiKey, selectedInstance!.instance_name, group.whatsapp_id, item.media_type, item.media_url, item.media_caption || undefined, item.media_filename || undefined);
                  }
                  break;
                case "poll":
                  if (item.poll_question && item.poll_options) {
                    return await sendPollMessage(globalApiUrl, globalApiKey, selectedInstance!.instance_name, group.whatsapp_id, item.poll_question, item.poll_options as string[], item.poll_allow_multiple || false);
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
              
              const endpoint = item.item_type === "text" 
                ? `${globalApiUrl}/message/sendText/${selectedInstance.instance_name}`
                : item.item_type === "poll"
                ? `${globalApiUrl}/message/sendPoll/${selectedInstance.instance_name}`
                : `${globalApiUrl}/message/sendMedia/${selectedInstance.instance_name}`;
                
              await logAuditEntry(supabase, {
                source: "process-scheduled",
                campaignId: campaign.id,
                groupId: group.id,
                itemId: item.id,
                instanceId: selectedInstance.id,
                userId: campaign.user_id,
                instanceName: selectedInstance.instance_name,
                groupWhatsappId: group.whatsapp_id,
                messageType: item.item_type,
                messagePreview: item.text_content || item.poll_question || `[${item.media_type}]`,
                apiEndpoint: endpoint,
                responsePayload: responseData,
                responseStatus: response.status,
              });
              
              if (!response.ok) {
                errorMessage = responseData?.message || `HTTP ${response.status}`;
                instanceFailures[selectedInstance.id] = (instanceFailures[selectedInstance.id] || 0) + 1;
              } else {
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

          if (itemIndex < items.length - 1) {
            const itemDelay = item.delay_after ? item.delay_after * 1000 : delayBetweenItems;
            await delay(itemDelay);
          }
        }

        if (groupSuccess) {
          sentCount++;
        } else {
          failedCount++;
        }

        if (groupIndex < shuffledGroups.length - 1) {
          await delay(delayBetweenGroups);
        }
      }
    } finally {
      // ALWAYS release locks
      for (const inst of lockedInstances) {
        await releaseInstanceLock(supabase, inst.id, executionId);
      }
    }

    // INTEGRITY CHECK - AUDIT ONLY
    console.log(`[${FUNCTION_NAME}] Running post-campaign integrity check (audit only)...`);
    const { realSentCount, realFailedCount } = await verifyCampaignIntegrity(
      supabase, campaign.id, items, campaignGroups, executionId
    );

    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        sent_count: realSentCount,
        failed_count: realFailedCount,
      })
      .eq("id", campaign.id);

    console.log(`[${FUNCTION_NAME}] [${executionId}] Campaign ${campaign.id} completed: ${realSentCount} sent, ${realFailedCount} failed`);
    return { success: true, sentCount: realSentCount, failedCount: realFailedCount, executionId };

  } catch (error) {
    console.error(`Error processing campaign ${campaign.id}:`, error);
    
    await supabase
      .from("campaigns")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
    
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Handle fully completed campaigns that are still marked as "running"
async function handleCompletedButStuckCampaigns(supabase: any) {
  console.log("Checking for completed campaigns still marked as running...");

  const { data: runningCampaigns, error } = await supabase
    .from("campaigns")
    .select(`
      id,
      name,
      user_id,
      started_at,
      campaign_groups (group_id),
      campaign_items (id)
    `)
    .eq("status", "running");

  if (error) {
    console.error("Error fetching running campaigns:", error);
    return [];
  }

  if (!runningCampaigns || runningCampaigns.length === 0) {
    return [];
  }

  const results = [];

  for (const campaign of runningCampaigns) {
    const totalGroups = campaign.campaign_groups?.length || 0;
    const totalItems = campaign.campaign_items?.length || 0;
    const expectedLogs = totalGroups * totalItems;

    if (expectedLogs === 0) continue;

    const { count: actualSentOrFailed } = await supabase
      .from("send_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "failed"]);

    if (actualSentOrFailed && actualSentOrFailed >= expectedLogs) {
      console.log(`Campaign ${campaign.id} has ${actualSentOrFailed}/${expectedLogs} resolved logs - marking as completed`);

      const { count: realSentCount } = await supabase
        .from("send_logs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "sent");

      const { count: realFailedCount } = await supabase
        .from("send_logs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed");

      await supabase
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sent_count: realSentCount || 0,
          failed_count: realFailedCount || 0,
        })
        .eq("id", campaign.id);

      await supabase.from("activity_logs").insert({
        user_id: campaign.user_id,
        action: "campaign_auto_completed",
        entity_type: "campaign",
        entity_id: campaign.id,
        details: {
          reason: "All logs resolved but status update failed",
          sent_count: realSentCount || 0,
          failed_count: realFailedCount || 0,
          recovered_at: new Date().toISOString(),
        },
      });

      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        autoCompleted: true,
        sentCount: realSentCount || 0,
        failedCount: realFailedCount || 0,
      });
    }
  }

  return results;
}

// Handle stuck campaigns - marks missing as failed (NO resending)
async function handleStuckCampaigns(supabase: any) {
  const MAX_RUNNING_TIME_MINUTES = 30;
  const stuckThreshold = new Date(Date.now() - MAX_RUNNING_TIME_MINUTES * 60 * 1000);

  console.log(`Checking for stuck campaigns (running since before ${stuckThreshold.toISOString()})`);

  const { data: stuckCampaigns, error } = await supabase
    .from("campaigns")
    .select(`
      *,
      campaign_groups (
        group_id,
        groups (id, name, whatsapp_id)
      ),
      campaign_items (id, item_type, text_content, media_url, media_type, media_caption, media_filename, poll_question, poll_options, poll_allow_multiple, order_index, delay_after)
    `)
    .eq("status", "running")
    .lt("started_at", stuckThreshold.toISOString());

  if (error) {
    console.error("Error fetching stuck campaigns:", error);
    return [];
  }

  if (!stuckCampaigns || stuckCampaigns.length === 0) {
    return [];
  }

  console.log(`Found ${stuckCampaigns.length} stuck campaigns to recover`);

  const results = [];

  for (const campaign of stuckCampaigns) {
    try {
      console.log(`Recovering stuck campaign: ${campaign.id} - ${campaign.name}`);

      // Release any instance locks for instances used by this campaign
      const { data: campaignInstancesForLock } = await supabase
        .from("campaign_instances")
        .select("instance_id")
        .eq("campaign_id", campaign.id);
      
      const lockInstanceIds = campaignInstancesForLock?.map((ci: any) => ci.instance_id) || [];
      if (campaign.whatsapp_instance_id && !lockInstanceIds.includes(campaign.whatsapp_instance_id)) {
        lockInstanceIds.push(campaign.whatsapp_instance_id);
      }
      
      if (lockInstanceIds.length > 0) {
        await supabase
          .from("instance_send_lock")
          .delete()
          .in("instance_id", lockInstanceIds);
        console.log(`Released ${lockInstanceIds.length} instance locks for stuck campaign ${campaign.id}`);
      }

      const allItems = campaign.campaign_items || [];

      // Get existing send_logs
      const { data: existingLogs } = await supabase
        .from("send_logs")
        .select("id, group_id, campaign_item_id, status, api_call_started_at, api_response")
        .eq("campaign_id", campaign.id);

      // Handle pending logs - mark as failed (NOT auto-sent)
      const pendingLogs = (existingLogs || []).filter((l: any) => l.status === "pending");

      for (const log of pendingLogs) {
        if (log.api_response) {
          // Had a response, likely sent successfully
          await supabase.from("send_logs").update({
            status: "sent",
            sent_at: log.api_call_started_at,
          }).eq("id", log.id);
        } else {
          // No response - inconclusive, mark as failed
          await supabase.from("send_logs").update({
            status: "failed",
            error_message: "Inconclusivo: timeout após iniciar envio. Pode ter sido entregue. Use retry manual se necessário.",
          }).eq("id", log.id);
        }
      }

      // Create failure logs for missing combinations (NO resending)
      const logSet = new Set((existingLogs || []).map((l: any) => `${l.campaign_item_id}:${l.group_id}`));
      let missingCreated = 0;

      for (const cg of (campaign.campaign_groups || [])) {
        const groupId = cg.group_id;
        for (const item of allItems) {
          const key = `${item.id}:${groupId}`;
          if (!logSet.has(key)) {
            await supabase.from("send_logs").insert({
              campaign_id: campaign.id,
              campaign_item_id: item.id,
              group_id: groupId,
              status: "failed",
              error_message: "Não enviado: timeout da função (recuperação automática). Use retry manual.",
            });
            missingCreated++;
          }
        }
      }

      const { count: realSentCount } = await supabase
        .from("send_logs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "sent");

      const { count: realFailedCount } = await supabase
        .from("send_logs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed");

      await supabase
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sent_count: realSentCount || 0,
          failed_count: realFailedCount || 0,
        })
        .eq("id", campaign.id);

      await supabase.from("activity_logs").insert({
        user_id: campaign.user_id,
        action: "campaign_recovered_from_timeout",
        entity_type: "campaign",
        entity_id: campaign.id,
        details: {
          original_started_at: campaign.started_at,
          recovered_at: new Date().toISOString(),
          sent_count: realSentCount || 0,
          failed_count: realFailedCount || 0,
          pending_resolved: pendingLogs.length,
          missing_logs_created: missingCreated,
          no_auto_resend: true,
        },
      });

      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        recovered: true,
        sentCount: realSentCount || 0,
        failedCount: realFailedCount || 0,
        pendingResolved: pendingLogs.length,
        missingLogsCreated: missingCreated,
      });

      console.log(`Campaign ${campaign.id} recovered: ${realSentCount} sent, ${realFailedCount} failed, ${missingCreated} missing logs created (NO auto-resend)`);

    } catch (err) {
      console.error(`Error recovering campaign ${campaign.id}:`, err);
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        recovered: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

function isCampaignStillValid(campaign: any): { valid: boolean; reason?: string } {
  const MAX_CAMPAIGN_AGE_HOURS = 24;
  
  if (campaign.scheduled_at) {
    const scheduledTime = new Date(campaign.scheduled_at);
    const maxValidTime = new Date(scheduledTime.getTime() + MAX_CAMPAIGN_AGE_HOURS * 60 * 60 * 1000);
    
    if (new Date() > maxValidTime) {
      return { 
        valid: false, 
        reason: `Campanha expirada - agendada para ${scheduledTime.toISOString()}, limite de ${MAX_CAMPAIGN_AGE_HOURS}h excedido`
      };
    }
  }
  
  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    console.log(`Checking for scheduled campaigns at ${now.toISOString()}`);

    const globalApiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const globalApiKey = await getSystemConfig(supabase, "evolution_api_key");

    const autoCompletedResults = await handleCompletedButStuckCampaigns(supabase);
    if (autoCompletedResults.length > 0) {
      console.log(`Auto-completed ${autoCompletedResults.length} campaigns that were fully processed`);
    }

    const stuckResults = await handleStuckCampaigns(supabase);
    if (stuckResults.length > 0) {
      console.log(`Recovered ${stuckResults.length} stuck campaigns`);
    }

    const { data: scheduledCampaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now.toISOString());

    if (campaignsError) {
      console.error("Error fetching scheduled campaigns:", campaignsError);
      throw new Error("Erro ao buscar campanhas agendadas");
    }

    console.log(`Found ${scheduledCampaigns?.length || 0} campaigns to process`);

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma campanha agendada para processar",
          processed: 0,
          autoCompleted: autoCompletedResults.length,
          stuckRecovered: stuckResults.length,
          autoCompletedResults: autoCompletedResults.length > 0 ? autoCompletedResults : undefined,
          stuckResults: stuckResults.length > 0 ? stuckResults : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!globalApiUrl || !globalApiKey) {
      throw new Error("Evolution API não configurada");
    }

    const results = [];

    for (const campaign of scheduledCampaigns) {
      const validityCheck = isCampaignStillValid(campaign);
      
      if (!validityCheck.valid) {
        console.log(`Skipping expired campaign ${campaign.id}: ${validityCheck.reason}`);
        
        await supabase
          .from("campaigns")
          .update({
            status: "cancelled",
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);

        await supabase.from("activity_logs").insert({
          user_id: campaign.user_id,
          action: "campaign_expired",
          entity_type: "campaign",
          entity_id: campaign.id,
          details: {
            reason: validityCheck.reason,
            scheduled_at: campaign.scheduled_at,
            expired_at: new Date().toISOString(),
          },
        });

        results.push({ 
          campaignId: campaign.id, 
          campaignName: campaign.name, 
          success: false, 
          skipped: true,
          reason: validityCheck.reason 
        });
        continue;
      }

      const result = await processCampaign(supabase, campaign, globalApiUrl, globalApiKey);
      results.push({ campaignId: campaign.id, campaignName: campaign.name, ...result });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${results.length} campanhas processadas`,
        processed: results.length,
        autoCompleted: autoCompletedResults.length,
        stuckRecovered: stuckResults.length,
        results,
        autoCompletedResults: autoCompletedResults.length > 0 ? autoCompletedResults : undefined,
        stuckResults: stuckResults.length > 0 ? stuckResults : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-scheduled-campaigns:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
