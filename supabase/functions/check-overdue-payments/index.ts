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
    return "";
  }
  
  return data?.value || "";
}

// Delete instances from Evolution API
async function deleteInstancesFromEvolution(
  supabase: any,
  apiUrl: string,
  apiKey: string,
  userId: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const errors: string[] = [];
  
  // Get all instances for this user
  const { data: instances, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    return { success: false, count: 0, errors: [`Error fetching instances: ${error.message}`] };
  }

  if (!instances || instances.length === 0) {
    return { success: true, count: 0, errors: [] };
  }

  console.log(`Deleting ${instances.length} instances for user ${userId}`);

  for (const instance of instances) {
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

      console.log(`Deleted instance ${instance.instance_name}: ${deleteResponse.status}`);

      // Update status in database
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);

    } catch (e) {
      const errorMsg = `Error deleting instance ${instance.instance_name}: ${(e as Error).message}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return { success: errors.length === 0, count: instances.length, errors };
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

    console.log("Starting overdue payments check...");

    // Get Evolution API config
    const apiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const apiKey = await getSystemConfig(supabase, "evolution_api_key");

    if (!apiUrl || !apiKey) {
      console.warn("Evolution API not configured, will only update database statuses");
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find users with expired subscriptions (more than 3 days overdue) that are not yet suspended
    const { data: overdueUsers, error: overdueError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        subscription_status,
        subscription_expires_at,
        suspended_at
      `)
      .lt("subscription_expires_at", threeDaysAgo.toISOString())
      .not("subscription_status", "in", '("suspended","cancelled")')
      .is("suspended_at", null);

    if (overdueError) {
      throw new Error(`Error fetching overdue users: ${overdueError.message}`);
    }

    console.log(`Found ${overdueUsers?.length || 0} users overdue for more than 3 days`);

    const results = {
      processed: 0,
      suspended: 0,
      instancesRemoved: 0,
      errors: [] as string[],
    };

    for (const user of overdueUsers || []) {
      console.log(`Processing user ${user.email} (${user.id})`);
      results.processed++;

      try {
        // Remove instances from Evolution API if configured
        if (apiUrl && apiKey) {
          const deleteResult = await deleteInstancesFromEvolution(supabase, apiUrl, apiKey, user.id);
          results.instancesRemoved += deleteResult.count;
          if (deleteResult.errors.length > 0) {
            results.errors.push(...deleteResult.errors);
          }
        }

        // Update profile to suspended
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            subscription_status: "suspended",
            suspended_at: now.toISOString(),
          })
          .eq("id", user.id);

        if (profileError) {
          throw new Error(`Error updating profile: ${profileError.message}`);
        }

        // Update subscription
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            status: "suspended",
            suspended_at: now.toISOString(),
          })
          .eq("user_id", user.id)
          .not("status", "in", '("suspended","cancelled")');

        if (subError) {
          console.warn(`Error updating subscription for ${user.email}: ${subError.message}`);
        }

        // Log the action
        await supabase.from("activity_logs").insert({
          action: "auto_suspend_overdue",
          entity_type: "user",
          entity_id: user.id,
          details: {
            email: user.email,
            expired_at: user.subscription_expires_at,
            days_overdue: Math.floor((now.getTime() - new Date(user.subscription_expires_at).getTime()) / (24 * 60 * 60 * 1000)),
          },
        });

        results.suspended++;
        console.log(`User ${user.email} suspended successfully`);

      } catch (e) {
        const errorMsg = `Error processing user ${user.email}: ${(e as Error).message}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    // Also update users whose subscription just expired (< 3 days) to payment_pending status
    const { data: recentlyExpired, error: recentError } = await supabase
      .from("profiles")
      .select("id, email, subscription_status, subscription_expires_at")
      .lt("subscription_expires_at", now.toISOString())
      .gte("subscription_expires_at", threeDaysAgo.toISOString())
      .not("subscription_status", "in", '("payment_pending","suspended","cancelled")');

    if (!recentError && recentlyExpired) {
      console.log(`Found ${recentlyExpired.length} users with recently expired subscriptions`);

      for (const user of recentlyExpired) {
        try {
          await supabase
            .from("profiles")
            .update({ subscription_status: "payment_pending" })
            .eq("id", user.id);

          await supabase
            .from("subscriptions")
            .update({ status: "payment_pending" })
            .eq("user_id", user.id)
            .not("status", "in", '("suspended","cancelled")');

          console.log(`User ${user.email} marked as payment_pending`);
        } catch (e) {
          console.error(`Error updating ${user.email} to payment_pending:`, e);
        }
      }
    }

    console.log("Overdue payments check completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Overdue payments check completed",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-overdue-payments:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
