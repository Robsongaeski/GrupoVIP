import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_NAME = "execute-group-actions";

// Helper to get system config
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
// AUDIT LOGGING - Rastreia chamadas desta função
// ============================================
async function logFunctionCall(
  supabase: any,
  params: {
    actionId?: string;
    actionType?: string;
    userId?: string;
    instanceName?: string;
    targetGroupsCount?: number;
    callerInfo: any;
    result?: string;
    error?: string;
  }
) {
  try {
    await supabase.from("message_audit_log").insert({
      source: "execute-group-actions",
      function_name: FUNCTION_NAME,
      user_id: params.userId,
      instance_name: params.instanceName,
      message_type: params.actionType,
      message_preview: params.result || params.error || `Processing ${params.targetGroupsCount || 0} groups`,
      was_blocked: !!params.error,
      block_reason: params.error,
      caller_info: params.callerInfo,
      request_payload: {
        action_id: params.actionId,
        action_type: params.actionType,
        target_groups_count: params.targetGroupsCount,
      },
    });
  } catch (error) {
    console.error("Error logging function call:", error);
  }
}

// Update group name via Evolution API
async function updateGroupName(apiUrl: string, apiKey: string, instanceName: string, groupId: string, newName: string) {
  console.log(`Calling Evolution API: POST ${apiUrl}/group/updateGroupSubject/${instanceName}`);
  console.log(`Body: groupJid=${groupId}, subject=${newName}`);
  
  const response = await fetch(`${apiUrl}/group/updateGroupSubject/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      groupJid: groupId,
      subject: newName,
    }),
  });
  
  const responseText = await response.text();
  console.log(`Response status: ${response.status}, body: ${responseText}`);
  
  return { 
    ok: response.ok, 
    status: response.status,
    data: responseText ? JSON.parse(responseText) : null 
  };
}

// Update group description via Evolution API
async function updateGroupDescription(apiUrl: string, apiKey: string, instanceName: string, groupId: string, description: string) {
  console.log(`Calling Evolution API: POST ${apiUrl}/group/updateGroupDescription/${instanceName}`);
  
  const response = await fetch(`${apiUrl}/group/updateGroupDescription/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      groupJid: groupId,
      description: description,
    }),
  });
  
  const responseText = await response.text();
  console.log(`Response status: ${response.status}, body: ${responseText}`);
  
  return { 
    ok: response.ok, 
    status: response.status,
    data: responseText ? JSON.parse(responseText) : null 
  };
}

// Update group photo via Evolution API
async function updateGroupPhoto(apiUrl: string, apiKey: string, instanceName: string, groupId: string, imageUrl: string) {
  console.log(`Calling Evolution API: POST ${apiUrl}/group/updateGroupPicture/${instanceName}`);
  
  const response = await fetch(`${apiUrl}/group/updateGroupPicture/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      groupJid: groupId,
      image: imageUrl,
    }),
  });
  
  const responseText = await response.text();
  console.log(`Response status: ${response.status}, body: ${responseText}`);
  
  return { 
    ok: response.ok, 
    status: response.status,
    data: responseText ? JSON.parse(responseText) : null 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Captura informações do caller para debugging
  const callerInfo = {
    userAgent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    xForwardedFor: req.headers.get("x-forwarded-for"),
    host: req.headers.get("host"),
    timestamp: new Date().toISOString(),
    method: req.method,
  };

  console.log(`[${FUNCTION_NAME}] Called at ${callerInfo.timestamp}`);
  console.log(`[${FUNCTION_NAME}] Caller info:`, JSON.stringify(callerInfo));

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // This can be called as a cron job or manually with an action ID
    const body = await req.json().catch(() => ({}));
    const specificActionId = body.actionId;

    console.log(`[${FUNCTION_NAME}] Executing group actions...`, specificActionId ? `specific: ${specificActionId}` : "all pending");

    // Get Evolution API config
    const apiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const apiKey = await getSystemConfig(supabase, "evolution_api_key");

    if (!apiUrl || !apiKey) {
      console.error(`[${FUNCTION_NAME}] Evolution API not configured`);
      await logFunctionCall(supabase, {
        callerInfo,
        error: "Evolution API não configurada",
      });
      return new Response(JSON.stringify({ 
        error: "Evolution API não configurada" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending actions that are due
    let query = supabase
      .from("group_actions")
      .select(`
        *,
        whatsapp_instances (
          instance_name,
          status
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString());

    if (specificActionId) {
      query = query.eq("id", specificActionId);
    }

    const { data: actions, error: actionsError } = await query.order("scheduled_at", { ascending: true });

    if (actionsError) {
      throw new Error(`Error fetching actions: ${actionsError.message}`);
    }

    console.log(`[${FUNCTION_NAME}] Found ${actions?.length || 0} actions to execute`);

    // Log esta chamada
    await logFunctionCall(supabase, {
      callerInfo,
      result: `Found ${actions?.length || 0} actions to process`,
    });

    const results = {
      executed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const action of actions || []) {
      const instance = action.whatsapp_instances;

      console.log(`[${FUNCTION_NAME}] Processing action ${action.id} (${action.action_type}) for user ${action.user_id}`);

      if (!instance || instance.status !== "connected") {
        console.log(`[${FUNCTION_NAME}] Skipping action ${action.id}: instance not connected`);
        
        await logFunctionCall(supabase, {
          actionId: action.id,
          actionType: action.action_type,
          userId: action.user_id,
          callerInfo,
          error: "Instância não conectada",
        });
        
        await supabase
          .from("group_actions")
          .update({ 
            status: "failed",
            error_message: "Instância não conectada",
            executed_at: new Date().toISOString()
          })
          .eq("id", action.id);
        
        results.skipped++;
        continue;
      }

      // Update action to executing
      await supabase
        .from("group_actions")
        .update({ status: "executing" })
        .eq("id", action.id);

      // Get target groups for this action
      const { data: targets, error: targetsError } = await supabase
        .from("group_action_targets")
        .select(`
          *,
          groups (
            id,
            whatsapp_id,
            name,
            description,
            photo_url
          )
        `)
        .eq("action_id", action.id)
        .eq("status", "pending");

      if (targetsError) {
        console.error(`[${FUNCTION_NAME}] Error fetching targets for action ${action.id}:`, targetsError);
        continue;
      }

      console.log(`[${FUNCTION_NAME}] Action ${action.id} has ${targets?.length || 0} targets`);

      // Log detalhado para debugging
      await logFunctionCall(supabase, {
        actionId: action.id,
        actionType: action.action_type,
        userId: action.user_id,
        instanceName: instance.instance_name,
        targetGroupsCount: targets?.length || 0,
        callerInfo,
        result: `Executing ${action.action_type} on ${targets?.length || 0} groups`,
      });

      let actionSuccess = true;
      let lastError: string | null = null;

      for (const target of targets || []) {
        const group = target.groups;

        if (!group) {
          console.log(`[${FUNCTION_NAME}] Skipping target ${target.id}: group not found`);
          continue;
        }

        try {
          // Create snapshot before making changes
          await supabase.from("group_snapshots").insert({
            action_id: action.id,
            group_id: group.id,
            name_before: group.name,
            description_before: group.description,
            photo_url_before: group.photo_url,
          });

          let response: { ok: boolean; status: number; data: any } | null = null;

          switch (action.action_type) {
            case "name":
              if (action.new_value_text) {
                let finalName = action.new_value_text;
                
                if (action.new_value_text.includes("{{PRESERVE_SUFFIX}}")) {
                  const baseName = action.new_value_text.replace("{{PRESERVE_SUFFIX}}", "");
                  const currentName = group.name;
                  
                  const hashIndex = currentName.indexOf("#");
                  if (hashIndex !== -1) {
                    const suffix = currentName.substring(hashIndex);
                    finalName = `${baseName} ${suffix}`;
                  } else {
                    finalName = baseName;
                  }
                  
                  console.log(`[${FUNCTION_NAME}] Preserving suffix: "${currentName}" -> "${finalName}"`);
                }
                
                console.log(`[${FUNCTION_NAME}] Updating name for group ${group.name} to "${finalName}"`);
                response = await updateGroupName(
                  apiUrl,
                  apiKey,
                  instance.instance_name,
                  group.whatsapp_id,
                  finalName
                );

                if (response.ok) {
                  await supabase
                    .from("groups")
                    .update({ name: finalName })
                    .eq("id", group.id);
                }
              }
              break;

            case "description":
              console.log(`[${FUNCTION_NAME}] Updating description for group ${group.name}`);
              response = await updateGroupDescription(
                apiUrl,
                apiKey,
                instance.instance_name,
                group.whatsapp_id,
                action.new_value_text || ""
              );

              if (response.ok) {
                await supabase
                  .from("groups")
                  .update({ description: action.new_value_text })
                  .eq("id", group.id);
              }
              break;

            case "photo":
              if (action.new_value_file_url) {
                console.log(`[${FUNCTION_NAME}] Updating photo for group ${group.name}`);
                response = await updateGroupPhoto(
                  apiUrl,
                  apiKey,
                  instance.instance_name,
                  group.whatsapp_id,
                  action.new_value_file_url
                );

                if (response.ok) {
                  await supabase
                    .from("groups")
                    .update({ photo_url: action.new_value_file_url })
                    .eq("id", group.id);
                }
              }
              break;
          }

          if (response) {
            if (response.ok) {
              await supabase
                .from("group_action_targets")
                .update({ 
                  status: "completed",
                  executed_at: new Date().toISOString()
                })
                .eq("id", target.id);
            } else {
              const errorMsg = response.data?.message || `HTTP ${response.status}`;
              lastError = errorMsg;
              actionSuccess = false;

              await supabase
                .from("group_action_targets")
                .update({ 
                  status: "failed",
                  error_message: errorMsg,
                  executed_at: new Date().toISOString()
                })
                .eq("id", target.id);
            }
          }

          // Small delay between group updates
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`[${FUNCTION_NAME}] Error executing action for group ${group.name}:`, error);
          lastError = error instanceof Error ? error.message : "Erro desconhecido";
          actionSuccess = false;

          await supabase
            .from("group_action_targets")
            .update({ 
              status: "failed",
              error_message: lastError,
              executed_at: new Date().toISOString()
            })
            .eq("id", target.id);
        }
      }

      // Update action status
      await supabase
        .from("group_actions")
        .update({ 
          status: actionSuccess ? "completed" : "failed",
          error_message: lastError,
          executed_at: new Date().toISOString()
        })
        .eq("id", action.id);

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: action.user_id,
        action: actionSuccess ? "group_action_completed" : "group_action_failed",
        entity_type: "group_action",
        entity_id: action.id,
        details: { 
          action_type: action.action_type,
          targets_count: targets?.length || 0,
          error: lastError,
          caller_info: callerInfo, // Incluir info de quem chamou
        }
      });

      if (actionSuccess) {
        results.executed++;
      } else {
        results.failed++;
      }
    }

    console.log(`[${FUNCTION_NAME}] Execution complete: ${results.executed} executed, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(JSON.stringify({ 
      success: true,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error);
    
    // Log error
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    await logFunctionCall(supabase, {
      callerInfo,
      error: error instanceof Error ? error.message : "Erro interno",
    });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
