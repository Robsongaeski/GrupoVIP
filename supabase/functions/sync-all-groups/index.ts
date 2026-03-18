import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface SyncResult {
  instanceId: string;
  instanceName: string;
  userId: string;
  groupsUpdated: number;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=== SYNC ALL GROUPS - CRON JOB STARTED ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Evolution API config from system_config
    const apiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const apiKey = await getSystemConfig(supabase, "evolution_api_key");

    if (!apiUrl || !apiKey) {
      console.error("Evolution API not configured");
      return new Response(JSON.stringify({ 
        error: "Evolution API não configurada" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all connected instances
    const { data: instances, error: instancesError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, user_id, phone_number")
      .eq("status", "connected");

    if (instancesError) {
      console.error("Error fetching instances:", instancesError);
      throw instancesError;
    }

    console.log(`Found ${instances?.length || 0} connected instances to sync`);

    const results: SyncResult[] = [];

    for (const instance of instances || []) {
      console.log(`\n--- Syncing instance: ${instance.instance_name} (${instance.id}) ---`);
      
      try {
        // Get instance phone for admin detection
        let instancePhone = instance.phone_number?.replace(/\D/g, "") || "";
        
        // If phone not set, try to fetch from Evolution API
        if (!instancePhone) {
          try {
            const allInstancesResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
              method: "GET",
              headers: { "apikey": apiKey },
            });
            
            if (allInstancesResponse.ok) {
              const allInstances = await allInstancesResponse.json();
              
              if (Array.isArray(allInstances)) {
                const ourInstance = allInstances.find((inst: any) => 
                  inst.instance?.instanceName === instance.instance_name ||
                  inst.instanceName === instance.instance_name
                );
                
                if (ourInstance) {
                  const owner = ourInstance.instance?.owner || ourInstance.owner;
                  if (owner) {
                    instancePhone = owner.split("@")[0].replace(/\D/g, "");
                    console.log(`Got phone from API: ${instancePhone}`);
                    
                    // Update in database
                    await supabase
                      .from("whatsapp_instances")
                      .update({ phone_number: instancePhone })
                      .eq("id", instance.id);
                  }
                }
              }
            }
          } catch (e) {
            console.error("Error fetching phone number:", e);
          }
        }

        // Fetch groups from Evolution API WITH participants
        const response = await fetch(
          `${apiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`,
          {
            method: "GET",
            headers: { "apikey": apiKey },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Evolution API error for ${instance.instance_name}: ${response.status} - ${errorText}`);
          results.push({
            instanceId: instance.id,
            instanceName: instance.instance_name,
            userId: instance.user_id,
            groupsUpdated: 0,
            error: `API error: ${response.status}`,
          });
          continue;
        }

        const groups = await response.json();
        console.log(`Fetched ${Array.isArray(groups) ? groups.length : 0} groups`);

        if (!Array.isArray(groups)) {
          console.error(`Invalid response for ${instance.instance_name}`);
          results.push({
            instanceId: instance.id,
            instanceName: instance.instance_name,
            userId: instance.user_id,
            groupsUpdated: 0,
            error: "Invalid API response",
          });
          continue;
        }

        // Get existing groups for this user
        const { data: existingGroups } = await supabase
          .from("groups")
          .select("id, whatsapp_id")
          .eq("user_id", instance.user_id);

        const existingGroupsMap = new Map(
          (existingGroups || []).map(g => [g.whatsapp_id, g.id])
        );

        let updatedCount = 0;
        let insertedCount = 0;

        // Process groups
        for (const group of groups) {
          // Check if user is admin
          let isUserAdmin = false;
          if (group.participants && instancePhone) {
            for (const participant of group.participants) {
              const participantPhone = (participant.phoneNumber || participant.id || "")
                .replace("@s.whatsapp.net", "")
                .replace("@lid", "")
                .replace(/\D/g, "");
              
              const phoneLast10 = participantPhone.slice(-10);
              const instancePhoneLast10 = instancePhone.slice(-10);
              
              if (participantPhone === instancePhone || phoneLast10 === instancePhoneLast10) {
                isUserAdmin = participant.admin === "admin" || participant.admin === "superadmin";
                break;
              }
            }
          }

          const memberCount = group.participants?.length || group.size || 0;
          const existingId = existingGroupsMap.get(group.id);

          if (existingId) {
            // Update existing group
            const { error: updateError } = await supabase
              .from("groups")
              .update({
                name: group.subject || group.name || "Grupo sem nome",
                description: group.desc || null,
                member_count: memberCount,
                participants_count: memberCount,
                is_user_admin: isUserAdmin,
                synced_at: new Date().toISOString(),
              })
              .eq("id", existingId);

            if (!updateError) {
              updatedCount++;
            }
          } else {
            // Insert new group
            const { error: insertError } = await supabase
              .from("groups")
              .insert({
                user_id: instance.user_id,
                instance_id: instance.id,
                whatsapp_id: group.id,
                name: group.subject || group.name || "Grupo sem nome",
                description: group.desc || null,
                member_count: memberCount,
                participants_count: memberCount,
                is_user_admin: isUserAdmin,
                is_active: false, // New groups start inactive
                synced_at: new Date().toISOString(),
              });

            if (!insertError) {
              insertedCount++;
            }
          }
        }

        console.log(`Instance ${instance.instance_name}: updated=${updatedCount}, inserted=${insertedCount}`);
        results.push({
          instanceId: instance.id,
          instanceName: instance.instance_name,
          userId: instance.user_id,
          groupsUpdated: updatedCount + insertedCount,
        });

        // Add a small delay between instances to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (instanceError) {
        console.error(`Error syncing instance ${instance.instance_name}:`, instanceError);
        results.push({
          instanceId: instance.id,
          instanceName: instance.instance_name,
          userId: instance.user_id,
          groupsUpdated: 0,
          error: (instanceError as Error).message,
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalUpdated = results.reduce((sum, r) => sum + r.groupsUpdated, 0);
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`\n=== SYNC ALL GROUPS COMPLETED ===`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Instances: ${results.length} total, ${successCount} success, ${errorCount} errors`);
    console.log(`Groups updated: ${totalUpdated}`);

    // Log to activity_logs for audit
    await supabase.from("activity_logs").insert({
      action: "sync_all_groups_cron",
      entity_type: "system",
      details: {
        instances_synced: successCount,
        instances_failed: errorCount,
        total_groups_updated: totalUpdated,
        duration_ms: duration,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      instances_synced: successCount,
      instances_failed: errorCount,
      total_groups_updated: totalUpdated,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("=== SYNC ALL GROUPS ERROR ===", error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
