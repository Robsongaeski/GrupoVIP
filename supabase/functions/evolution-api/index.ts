import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvolutionRequest {
  action: "create" | "connect" | "disconnect" | "delete" | "status" | "qrcode" | "fetch-groups" | "test-connection" | "fetch-invite-code" | "delete-by-user";
  instanceId?: string;
  instanceName?: string;
  apiUrl?: string;
  apiKey?: string;
  onlyAdmin?: boolean;
  groupId?: string;
  whatsappGroupId?: string;
  userId?: string; // For admin operations to delete instances of a user
}

// Helper to get system config
async function getSystemConfig(supabase: any, key: string): Promise<string> {
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();
    
  if (error) {
    console.error(`Error fetching config ${key}:`, error);
    throw new Error(`Configuração ${key} não encontrada`);
  }
  
  return data?.value || "";
}

async function configureInstanceSettings(apiUrl: string, apiKey: string, instanceName: string) {
  try {
    const response = await fetch(`${apiUrl}/settings/set/${instanceName}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify({
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Failed to configure ${instanceName}:`, errorData);
      return { success: false, error: errorData.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`Error configuring ${instanceName}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
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
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Evolution API config from system_config
    const apiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const apiKey = await getSystemConfig(supabase, "evolution_api_key");

    if (!apiUrl || !apiKey) {
      return new Response(JSON.stringify({ 
        error: "Evolution API não configurada. Contate o administrador." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: EvolutionRequest = await req.json();
    console.log(`Evolution API action: ${body.action} by user ${user.id}`);

    switch (body.action) {
      case "test-connection": {
        // Test connection using provided or stored credentials
        const testUrl = body.apiUrl || await getSystemConfig(supabase, "evolution_api_url");
        const testKey = body.apiKey || await getSystemConfig(supabase, "evolution_api_key");

        if (!testUrl || !testKey) {
          throw new Error("URL e API Key são obrigatórios");
        }

        const response = await fetch(`${testUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: {
            "apikey": testKey,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Erro HTTP ${response.status}`);
        }

        const data = await response.json();
        return new Response(JSON.stringify({ 
          success: true, 
          instanceCount: Array.isArray(data) ? data.length : 0,
          message: `Conexão bem sucedida! ${Array.isArray(data) ? data.length : 0} instâncias encontradas.`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        if (!body.instanceName) {
          throw new Error("Nome da instância é obrigatório");
        }

        // Create instance in Evolution API
        const response = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey,
          },
          body: JSON.stringify({
            instanceName: body.instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            syncFullHistory: false,
          }),
        });

        const data = await response.json();
        console.log("Evolution create response:", data);

        if (!response.ok) {
          // Extract error message from Evolution API response
          let errorMessage = "Erro ao criar instância na Evolution API";
          
          if (data.response?.message) {
            // Handle array of messages
            if (Array.isArray(data.response.message)) {
              errorMessage = data.response.message.join(", ");
            } else {
              errorMessage = data.response.message;
            }
          } else if (data.message) {
            if (Array.isArray(data.message)) {
              errorMessage = data.message.join(", ");
            } else {
              errorMessage = data.message;
            }
          }
          
          throw new Error(errorMessage);
        }

        // Wait for instance to initialize before configuring settings
        await new Promise(r => setTimeout(r, 3000));
        let settingsResult = await configureInstanceSettings(apiUrl, apiKey, body.instanceName);
        if (!settingsResult.success) {
          console.warn(`[CREATE] Settings failed on first attempt for ${body.instanceName}, retrying...`);
          await new Promise(r => setTimeout(r, 3000));
          settingsResult = await configureInstanceSettings(apiUrl, apiKey, body.instanceName);
        }

        return new Response(JSON.stringify({ success: true, data, settingsConfigured: settingsResult.success, settingsError: settingsResult.error }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect":
      case "qrcode": {
        // Get instance from database
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        // Get QR Code / Connect from Evolution API
        const response = await fetch(`${apiUrl}/instance/connect/${instance.instance_name}`, {
          method: "GET",
          headers: {
            "apikey": apiKey,
          },
        });

        const data = await response.json();
        console.log("Evolution connect response:", JSON.stringify(data).slice(0, 500));

        // Check if already connected
        if (data.instance?.state === "open") {
          const settingsResult = await configureInstanceSettings(apiUrl, apiKey, instance.instance_name);

          await supabase
            .from("whatsapp_instances")
            .update({ 
              status: "connected",
              qr_code: null,
              last_connected_at: new Date().toISOString()
            })
            .eq("id", body.instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            status: "connected",
            message: settingsResult.success ? "Já conectado!" : "Já conectado, mas não foi possível reaplicar as proteções da instância.",
            settingsConfigured: settingsResult.success,
            settingsError: settingsResult.error,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Extract QR code - Evolution API returns it in different formats
        let qrCodeBase64 = null;
        
        // Try different response structures from Evolution API
        if (data.base64) {
          // Format: data:image/png;base64,xxx - extract just the base64 part
          qrCodeBase64 = data.base64.replace(/^data:image\/\w+;base64,/, "");
        } else if (data.qrcode?.base64) {
          qrCodeBase64 = data.qrcode.base64.replace(/^data:image\/\w+;base64,/, "");
        } else if (data.code) {
          // Some versions return raw code without base64 image
          console.log("QR code raw data available but no base64 image");
        }

        console.log("QR Code extracted:", qrCodeBase64 ? "yes" : "no");

        // Update with QR code if available
        if (qrCodeBase64) {
          await supabase
            .from("whatsapp_instances")
            .update({ 
              qr_code: qrCodeBase64,
              status: "qr_pending"
            })
            .eq("id", body.instanceId);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          qrcode: qrCodeBase64,
          status: data.instance?.state || "qr_pending"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        // Get instance from database
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada no banco de dados");
        }

        // Get status from Evolution API
        const response = await fetch(`${apiUrl}/instance/connectionState/${instance.instance_name}`, {
          method: "GET",
          headers: {
            "apikey": apiKey,
          },
        });

        const data = await response.json();
        console.log("Evolution status response:", data);

        // Check if instance doesn't exist in Evolution API
        if (!response.ok || data.error || data.message?.includes("not found") || data.message?.includes("não encontrada")) {
          console.warn("Instance missing in Evolution API. Auto-recreate blocked to avoid replaying queued/old messages.");

          await supabase
            .from("whatsapp_instances")
            .update({ 
              status: "disconnected",
              qr_code: null,
              phone_number: null
            })
            .eq("id", body.instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            status: "disconnected",
            missingRemote: true,
            message: "Instância ausente na Evolution API. A recriação automática foi bloqueada para evitar replay de mensagens antigas. Exclua e crie novamente manualmente."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Map Evolution status to our status
        let status: "connected" | "disconnected" | "connecting" | "qr_pending" = "disconnected";
        let phoneNumber = instance.phone_number;
        
        if (data.instance?.state === "open") {
          status = "connected";

          // Re-apply anti-replay settings on every connected status check
          const settingsResult = await configureInstanceSettings(apiUrl, apiKey, instance.instance_name);
          if (!settingsResult.success) {
            console.warn(`[STATUS] Failed to re-apply settings for ${instance.instance_name}: ${settingsResult.error}`);
          } else {
            console.log(`[STATUS] ✅ Re-applied anti-replay settings for ${instance.instance_name}`);
          }
          
          // If connected but no phone number, try to fetch it
          if (!phoneNumber) {
            try {
              const profileResponse = await fetch(`${apiUrl}/chat/fetchProfile/${instance.instance_name}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": apiKey,
                },
                body: JSON.stringify({ number: "" }),
              });
              
              if (!profileResponse.ok) {
                const ownerResponse = await fetch(`${apiUrl}/instance/fetchInstances/${instance.instance_name}`, {
                  method: "GET",
                  headers: { "apikey": apiKey },
                });
                const ownerData = await ownerResponse.json();
                phoneNumber = ownerData?.instance?.owner?.split("@")[0] || null;
              } else {
                const profileData = await profileResponse.json();
                phoneNumber = profileData?.number || profileData?.wid?.user || null;
              }
            } catch (e) {
              console.error("Error fetching phone number:", e);
            }
          }
        } else if (data.instance?.state === "connecting") {
          status = "connecting";
        } else if (data.instance?.state === "close") {
          status = "disconnected";
        }

        // Update status in database
        await supabase
          .from("whatsapp_instances")
          .update({ 
            status,
            phone_number: phoneNumber || instance.phone_number,
            last_connected_at: status === "connected" ? new Date().toISOString() : instance.last_connected_at,
            qr_code: status === "connected" ? null : instance.qr_code
          })
          .eq("id", body.instanceId);

        return new Response(JSON.stringify({ success: true, status, raw: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        // Get instance from database
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        // Logout from Evolution API
        const response = await fetch(`${apiUrl}/instance/logout/${instance.instance_name}`, {
          method: "DELETE",
          headers: {
            "apikey": apiKey,
          },
        });

        const data = await response.json();
        console.log("Evolution disconnect response:", data);

        // Also delete the instance from Evolution API
        try {
          const deleteResponse = await fetch(`${apiUrl}/instance/delete/${instance.instance_name}`, {
            method: "DELETE",
            headers: {
              "apikey": apiKey,
            },
          });
          const deleteData = await deleteResponse.json();
          console.log("Evolution delete after disconnect response:", deleteData);
        } catch (deleteError) {
          console.error("Error deleting instance from Evolution API:", deleteError);
        }

        // Update status
        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", body.instanceId);

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        // Get instance from database
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        console.log(`Deleting instance ${instance.instance_name} from Evolution API`);

        // Delete from Evolution API
        const response = await fetch(`${apiUrl}/instance/delete/${instance.instance_name}`, {
          method: "DELETE",
          headers: {
            "apikey": apiKey,
          },
        });

        let data = {};
        try {
          data = await response.json();
          console.log("Evolution delete response:", data);
        } catch (e) {
          console.log("Evolution delete response (no JSON):", response.status);
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete-by-user": {
        // Admin operation to delete all instances of a user
        // Check if current user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .single();

        if (!roleData) {
          throw new Error("Acesso negado: apenas administradores podem executar esta ação");
        }

        if (!body.userId) {
          throw new Error("userId é obrigatório");
        }

        // Get all instances for this user
        const { data: instances, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("user_id", body.userId);

        if (error) {
          throw new Error("Erro ao buscar instâncias do usuário");
        }

        console.log(`Deleting ${instances?.length || 0} instances for user ${body.userId}`);

        const results = [];
        for (const instance of instances || []) {
          try {
            // First logout
            await fetch(`${apiUrl}/instance/logout/${instance.instance_name}`, {
              method: "DELETE",
              headers: { "apikey": apiKey },
            });

            // Then delete from Evolution API
            const deleteResponse = await fetch(`${apiUrl}/instance/delete/${instance.instance_name}`, {
              method: "DELETE",
              headers: { "apikey": apiKey },
            });

            const deleteData = await deleteResponse.json().catch(() => ({}));
            console.log(`Deleted instance ${instance.instance_name}:`, deleteResponse.status);

            // Update status in database
            await supabase
              .from("whatsapp_instances")
              .update({ status: "disconnected", qr_code: null })
              .eq("id", instance.id);

            results.push({ instanceId: instance.id, instanceName: instance.instance_name, success: true });
          } catch (e) {
            console.error(`Error deleting instance ${instance.instance_name}:`, e);
            results.push({ instanceId: instance.id, instanceName: instance.instance_name, success: false, error: (e as Error).message });
          }
        }

        return new Response(JSON.stringify({ success: true, results, count: instances?.length || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "fetch-groups": {
        // Get onlyAdmin flag from request
        const onlyAdmin = body.onlyAdmin === true;
        console.log(`Fetching groups with onlyAdmin=${onlyAdmin}`);
        
        // Get instance from database
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        // Get the phone number from instance to check admin status
        let instancePhone = instance.phone_number?.replace(/\D/g, "") || "";
        console.log(`Instance phone for admin check: ${instancePhone || "NOT SET"}`);
        
        // If phone number is not set, try to fetch it from Evolution API
        if (!instancePhone) {
          console.log("Phone number not set, trying to fetch from Evolution API...");
          try {
            const allInstancesResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
              method: "GET",
              headers: { "apikey": apiKey },
            });
            
            if (allInstancesResponse.ok) {
              const allInstances = await allInstancesResponse.json();
              console.log(`Fetched ${Array.isArray(allInstances) ? allInstances.length : 0} instances to find phone`);
              
              if (Array.isArray(allInstances)) {
                const ourInstance = allInstances.find((inst: any) => 
                  inst.instance?.instanceName === instance.instance_name ||
                  inst.instanceName === instance.instance_name ||
                  inst.name === instance.instance_name
                );
                
                if (ourInstance) {
                  console.log("Found our instance data:", JSON.stringify(ourInstance).slice(0, 800));
                  // Try different property paths for owner
                  const owner = ourInstance.instance?.owner || 
                                ourInstance.owner || 
                                ourInstance.instance?.ownerJid ||
                                ourInstance.ownerJid;
                  if (owner) {
                    instancePhone = owner.split("@")[0].replace(/\D/g, "");
                    console.log("Got phone from fetchInstances:", instancePhone);
                    
                    // Update the instance in database with the phone number
                    await supabase
                      .from("whatsapp_instances")
                      .update({ phone_number: instancePhone })
                      .eq("id", instance.id);
                    
                    console.log("Updated instance phone_number in database");
                  }
                }
              }
            }
          } catch (e) {
            console.error("Error fetching phone number:", e);
          }
        }
        
        if (!instancePhone) {
          console.warn("Instance phone_number still not set - admin detection will not work properly");
        }

        // Fetch groups from Evolution API WITH participants to check admin status
        const response = await fetch(`${apiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`, {
          method: "GET",
          headers: {
            "apikey": apiKey,
          },
        });

        const groups = await response.json();
        console.log(`Fetched ${Array.isArray(groups) ? groups.length : 0} groups from Evolution API`);
        
        // Debug: Log first group structure to understand participants format
        if (Array.isArray(groups) && groups.length > 0) {
          const sampleGroup = groups[0];
          console.log(`Sample group structure: id=${sampleGroup.id}, subject=${sampleGroup.subject}`);
          console.log(`Has participants: ${!!sampleGroup.participants}, count: ${sampleGroup.participants?.length || 0}`);
          if (sampleGroup.participants && sampleGroup.participants.length > 0) {
            console.log(`Sample participant: ${JSON.stringify(sampleGroup.participants[0])}`);
          }
        }

        if (!Array.isArray(groups)) {
          throw new Error("Resposta inválida da API");
        }

        // Get existing groups by whatsapp_id (N:N relationship - groups can have multiple instances)
        const { data: existingGroups } = await supabase
          .from("groups")
          .select("id, whatsapp_id")
          .eq("user_id", user.id);

        const existingGroupsMap = new Map(
          (existingGroups || []).map(g => [g.whatsapp_id, g.id])
        );

        // Track group_instances to upsert
        const groupInstancesToUpsert: { group_id: string; instance_id: string; is_admin: boolean }[] = [];

        // Prepare batch data
        const groupsToInsert: any[] = [];
        const groupsToUpdate: { id: string; data: any }[] = [];
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        // Helper function to fetch invite code for a group
        async function fetchInviteCode(groupId: string, groupName: string): Promise<string | null> {
          try {
            console.log(`Fetching invite code for group: ${groupName} (${groupId})`);
            const response = await fetch(`${apiUrl}/group/inviteCode/${instance.instance_name}?groupJid=${encodeURIComponent(groupId)}`, {
              method: "GET",
              headers: { "apikey": apiKey },
            });
            
            if (response.ok) {
              const data = await response.json();
              const code = data.inviteCode || data.code || null;
              console.log(`Invite code for ${groupName}: ${code || 'NOT FOUND'}`);
              return code;
            } else {
              const errorText = await response.text();
              console.error(`Failed to get invite code for ${groupName}: HTTP ${response.status} - ${errorText}`);
            }
          } catch (e) {
            console.error(`Error fetching invite code for ${groupId}:`, e);
          }
          return null;
        }

        // Process groups in batches
        const BATCH_SIZE = 100;
        
        for (let i = 0; i < groups.length; i += BATCH_SIZE) {
          const batch = groups.slice(i, i + BATCH_SIZE);
          
          for (const group of batch) {
            // Check if user is admin of this group
            let isUserAdmin = false;
            if (group.participants && instancePhone) {
              // Debug: Log first group's participants structure
              if (i === 0) {
                console.log(`DEBUG Admin Check - Instance phone: ${instancePhone}`);
                if (group.participants.length > 0) {
                  group.participants.slice(0, 3).forEach((p: any, idx: number) => {
                    console.log(`DEBUG Participant ${idx}: id=${p.id}, phoneNumber=${p.phoneNumber}, admin=${p.admin}`);
                  });
                }
              }
              
              // Find the user in participants list
              for (const participant of group.participants) {
                // CRITICAL FIX: Use phoneNumber field, NOT id field
                // The id field contains Local ID (LID) like "263690087616567@lid"
                // The phoneNumber field contains actual phone like "5519996200604@s.whatsapp.net"
                const participantPhone = (participant.phoneNumber || participant.id || "")
                  .replace("@s.whatsapp.net", "")
                  .replace("@lid", "")
                  .replace(/\D/g, "");
                
                // Compare using multiple strategies for phone matching
                // Strategy 1: Exact match
                // Strategy 2: Last 10 digits match (handles different country code formats)
                // Strategy 3: Last 8 digits match (fallback)
                const phoneLast10 = participantPhone.slice(-10);
                const instancePhoneLast10 = instancePhone.slice(-10);
                const phoneLast8 = participantPhone.slice(-8);
                const instancePhoneLast8 = instancePhone.slice(-8);
                
                const isCurrentUser = participantPhone === instancePhone || 
                  phoneLast10 === instancePhoneLast10 ||
                  phoneLast8 === instancePhoneLast8;
                
                if (isCurrentUser) {
                  // Check if user has admin role
                  isUserAdmin = participant.admin === "admin" || participant.admin === "superadmin";
                  console.log(`Group ${group.subject}: MATCH FOUND! phoneNumber=${participant.phoneNumber}, admin=${participant.admin}, isAdmin=${isUserAdmin}`);
                  break;
                }
              }
            }

            // If onlyAdmin flag is set and user is not admin, skip this group
            if (onlyAdmin && !isUserAdmin) {
              continue;
            }

            // Only fetch invite code if user is admin (otherwise it will fail anyway)
            let inviteCode = group.inviteCode || null;
            const groupName = group.subject || group.name || "Grupo";
            
            // Only try to get invite code if user is admin to avoid unnecessary API calls
            if (!inviteCode && isUserAdmin) {
              console.log(`Fetching invite code for ${groupName} (user is admin)`);
              inviteCode = await fetchInviteCode(group.id, groupName);
            }

            // Get existing group to preserve is_active status
            const existingId = existingGroupsMap.get(group.id);

            const groupData = {
              user_id: user.id,
              instance_id: instance.id,
              whatsapp_id: group.id,
              name: group.subject || group.name || "Grupo sem nome",
              description: group.desc || null,
              invite_link: inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null,
              member_count: group.participants?.length || group.size || 0,
              participants_count: group.participants?.length || group.size || 0,
              max_members: 256,
              // New groups are inactive by default, existing groups keep their status
              is_active: existingId ? undefined : false,
              is_user_admin: isUserAdmin,
              synced_at: new Date().toISOString(),
            };

            // Remove undefined values for updates
            if (existingId) {
              delete groupData.is_active;
              groupsToUpdate.push({ id: existingId, data: groupData });
              // Track group_instance relationship for existing groups
              groupInstancesToUpsert.push({
                group_id: existingId,
                instance_id: instance.id,
                is_admin: isUserAdmin,
              });
            } else {
              // Mark new groups for insert - we'll add group_instances after insert
              groupsToInsert.push({ ...groupData, _tempWhatsappId: group.id, _isUserAdmin: isUserAdmin });
            }
          }

          // Process inserts for this batch
          if (groupsToInsert.length >= BATCH_SIZE || i + BATCH_SIZE >= groups.length) {
            if (groupsToInsert.length > 0) {
              // Remove temp fields before insert
              const cleanGroupsToInsert = groupsToInsert.map(g => {
                const { _tempWhatsappId, _isUserAdmin, ...clean } = g;
                return clean;
              });
              
              const { error: insertError, data: insertedData } = await supabase
                .from("groups")
                .insert(cleanGroupsToInsert)
                .select("id, whatsapp_id");
              
              if (insertError) {
                console.error("Error inserting groups batch:", insertError.message);
                errorCount += groupsToInsert.length;
              } else {
                insertedCount += insertedData?.length || 0;
                // Track group_instances for newly inserted groups
                for (const inserted of insertedData || []) {
                  const original = groupsToInsert.find(g => g.whatsapp_id === inserted.whatsapp_id);
                  if (original) {
                    groupInstancesToUpsert.push({
                      group_id: inserted.id,
                      instance_id: instance.id,
                      is_admin: original._isUserAdmin || false,
                    });
                  }
                }
              }
              groupsToInsert.length = 0; // Clear array
            }
          }
        }

        // Process remaining updates in chunks
        const UPDATE_CHUNK_SIZE = 30;
        for (let i = 0; i < groupsToUpdate.length; i += UPDATE_CHUNK_SIZE) {
          const chunk = groupsToUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
          const results = await Promise.allSettled(
            chunk.map(({ id, data }) =>
              supabase.from("groups").update(data).eq("id", id)
            )
          );
          updatedCount += results.filter(r => r.status === "fulfilled").length;
          errorCount += results.filter(r => r.status === "rejected").length;
        }

        // Upsert group_instances relationships (N:N)
        if (groupInstancesToUpsert.length > 0) {
          console.log(`Upserting ${groupInstancesToUpsert.length} group_instances relationships`);
          const UPSERT_CHUNK_SIZE = 50;
          for (let i = 0; i < groupInstancesToUpsert.length; i += UPSERT_CHUNK_SIZE) {
            const chunk = groupInstancesToUpsert.slice(i, i + UPSERT_CHUNK_SIZE);
            const { error: upsertError } = await supabase
              .from("group_instances")
              .upsert(chunk.map(gi => ({
                ...gi,
                synced_at: new Date().toISOString(),
              })), { onConflict: "group_id,instance_id" });
            
            if (upsertError) {
              console.error("Error upserting group_instances:", upsertError.message);
            }
          }
        }

        // === AUTO-RECOVERY: Attempt to recover orphaned link groups ===
        try {
          console.log("Attempting auto-recovery of orphaned link groups...");
          
          // Find groups in history that were removed but now exist again
          const { data: recoverableHistory, error: historyError } = await supabase
            .from("link_group_history")
            .select(`
              id,
              link_id,
              whatsapp_id,
              group_name,
              intelligent_links!inner(user_id)
            `)
            .not("removed_at", "is", null);

          if (!historyError && recoverableHistory && recoverableHistory.length > 0) {
            // Filter to only this user's links
            const userHistory = recoverableHistory.filter(
              (h: any) => h.intelligent_links?.user_id === user.id
            );
            
            let autoRecoveredCount = 0;
            
            for (const history of userHistory) {
              // Check if group now exists for this user
              const { data: matchingGroup } = await supabase
                .from("groups")
                .select("id")
                .eq("whatsapp_id", history.whatsapp_id)
                .eq("user_id", user.id)
                .maybeSingle();

              if (matchingGroup) {
                // Check if link_groups entry already exists
                const { data: existingLink } = await supabase
                  .from("link_groups")
                  .select("id")
                  .eq("link_id", history.link_id)
                  .eq("group_id", matchingGroup.id)
                  .maybeSingle();

                if (!existingLink) {
                  // Reconnect the group to the link
                  const { error: insertError } = await supabase
                    .from("link_groups")
                    .insert({
                      link_id: history.link_id,
                      group_id: matchingGroup.id,
                      is_active: true,
                      priority: 0
                    });

                  if (!insertError) {
                    autoRecoveredCount++;
                    console.log(`Auto-recovered group ${history.group_name} (${history.whatsapp_id}) to link ${history.link_id}`);
                  }
                }
              }
            }

            if (autoRecoveredCount > 0) {
              console.log(`Auto-recovery completed: ${autoRecoveredCount} groups reconnected to their links`);
            }
          }
        } catch (recoveryError) {
          console.error("Auto-recovery error (non-fatal):", recoveryError);
          // Don't fail the sync if auto-recovery fails
        }

        console.log(`Synced: ${insertedCount} new, ${updatedCount} updated, ${errorCount} errors, ${groupInstancesToUpsert.length} group_instances`);

        return new Response(JSON.stringify({ 
          success: true, 
          count: groups.length,
          inserted: insertedCount,
          updated: updatedCount,
          errors: errorCount,
          message: `${groups.length} grupos sincronizados`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "fetch-invite-code": {
        if (!body.groupId || !body.whatsappGroupId) {
          throw new Error("groupId e whatsappGroupId são obrigatórios");
        }

        // Get the group and its instance
        const { data: groupData, error: groupError } = await supabase
          .from("groups")
          .select("id, name, instance_id, whatsapp_id")
          .eq("id", body.groupId)
          .eq("user_id", user.id)
          .single();

        if (groupError || !groupData) {
          throw new Error("Grupo não encontrado ou acesso negado");
        }

        // Get instance data
        const { data: instanceData, error: instanceError } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", groupData.instance_id)
          .single();

        if (instanceError || !instanceData) {
          throw new Error("Instância não encontrada");
        }

        console.log(`Fetching invite code for group ${groupData.name} (${body.whatsappGroupId}) via instance ${instanceData.instance_name}`);

        // Fetch invite code from Evolution API
        const inviteResponse = await fetch(
          `${apiUrl}/group/inviteCode/${instanceData.instance_name}?groupJid=${encodeURIComponent(body.whatsappGroupId)}`,
          {
            method: "GET",
            headers: { "apikey": apiKey },
          }
        );

        if (!inviteResponse.ok) {
          const errorText = await inviteResponse.text();
          console.error(`Failed to get invite code: HTTP ${inviteResponse.status} - ${errorText}`);
          throw new Error("Não foi possível obter o link de convite. Verifique se você é admin do grupo.");
        }

        const inviteData = await inviteResponse.json();
        const inviteCode = inviteData.inviteCode || inviteData.code || null;

        if (!inviteCode) {
          throw new Error("Link de convite não disponível. Verifique se você é admin do grupo.");
        }

        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        console.log(`Got invite code for ${groupData.name}: ${inviteCode}`);

        // Update the group with the invite link
        const { error: updateError } = await supabase
          .from("groups")
          .update({ 
            invite_link: inviteLink,
            is_user_admin: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", body.groupId);

        if (updateError) {
          console.error("Error updating group:", updateError);
          throw new Error("Erro ao salvar link de convite");
        }

        return new Response(JSON.stringify({
          success: true,
          invite_link: inviteLink
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "purge-queue": {
        // NUCLEAR OPTION: logout → delete → recreate → configure
        // Clears Baileys internal message store to stop phantom/replayed messages
        if (!body.instanceId) {
          throw new Error("instanceId é obrigatório");
        }

        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        console.log(`[PURGE] Starting purge for instance ${instance.instance_name}`);

        // Step 1: Logout
        try {
          await fetch(`${apiUrl}/instance/logout/${instance.instance_name}`, {
            method: "DELETE",
            headers: { "apikey": apiKey },
          });
          console.log(`[PURGE] Logged out ${instance.instance_name}`);
        } catch (e) {
          console.warn(`[PURGE] Logout failed (may already be disconnected):`, e);
        }

        // Step 2: Delete from Evolution API (clears Baileys store)
        try {
          await fetch(`${apiUrl}/instance/delete/${instance.instance_name}`, {
            method: "DELETE",
            headers: { "apikey": apiKey },
          });
          console.log(`[PURGE] Deleted ${instance.instance_name} from Evolution API`);
        } catch (e) {
          console.warn(`[PURGE] Delete failed:`, e);
        }

        // Step 3: Wait for cleanup before recreating
        await new Promise(r => setTimeout(r, 3000));

        // Step 4: Recreate with same name + anti-replay settings
        const createResponse = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey,
          },
          body: JSON.stringify({
            instanceName: instance.instance_name,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            syncFullHistory: false,
          }),
        });

        const createData = await createResponse.json();
        console.log(`[PURGE] Recreated ${instance.instance_name}:`, createResponse.status);

        if (!createResponse.ok) {
          throw new Error(`Erro ao recriar instância: ${createData.message || createResponse.status}`);
        }

        // Step 5: Configure settings with retry (instance may not be ready immediately)
        await new Promise(r => setTimeout(r, 3000));
        let settingsResult = await configureInstanceSettings(apiUrl, apiKey, instance.instance_name);
        if (!settingsResult.success) {
          console.warn(`[PURGE] Settings failed on first attempt, retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          settingsResult = await configureInstanceSettings(apiUrl, apiKey, instance.instance_name);
        }
        console.log(`[PURGE] Settings configured: ${settingsResult.success}${settingsResult.error ? ` (error: ${settingsResult.error})` : ""}`);

        // Step 6: Update DB status
        await supabase
          .from("whatsapp_instances")
          .update({
            status: "disconnected",
            qr_code: null,
            phone_number: null,
          })
          .eq("id", body.instanceId);

        return new Response(JSON.stringify({
          success: true,
          message: "Fila limpa com sucesso! A instância foi recriada do zero. Conecte novamente via QR Code.",
          settingsConfigured: settingsResult.success,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Evolution API error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
