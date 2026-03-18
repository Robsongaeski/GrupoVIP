import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  periodicity: string;
  max_instances: number | null;
  max_groups: number | null;
  max_links: number | null;
  max_campaigns_month: number | null;
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan: Plan;
}

interface UsageLimits {
  instances: { current: number; max: number | null };
  groups: { current: number; max: number | null };
  links: { current: number; max: number | null };
  campaigns: { current: number; max: number | null };
}

// Admin user with lifetime subscription (never charged)
const LIFETIME_ADMIN_EMAIL = "robsongaeski@gmail.com";

export function useSubscription() {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is the lifetime admin
  const isLifetimeAdmin = user?.email === LIFETIME_ADMIN_EMAIL;

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user, effectiveUserId]);

  const fetchSubscription = async () => {
    if (!user) return;

    try {
      // Fetch subscription with plan - prioritize active/trial subscriptions
      // First, try to get an active or trial subscription that hasn't expired
      const { data: allSubs, error: subError } = await supabase
        .from("subscriptions")
        .select(`
          id,
          status,
          started_at,
          expires_at,
          plan:plans (
            id,
            name,
            description,
            price,
            periodicity,
            max_instances,
            max_groups,
            max_links,
            max_campaigns_month,
            features
          )
        `)
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (subError) throw subError;

      // Prioritize subscriptions: active with valid expiry > trial with valid expiry > payment_pending > others
      let subData = null;
      if (allSubs && allSubs.length > 0) {
        const now = new Date();
        
        // First priority: active or trial with valid expiry (or no expiry)
        subData = allSubs.find(sub => 
          (sub.status === 'active' || sub.status === 'trial') && 
          (!sub.expires_at || new Date(sub.expires_at) > now)
        );
        
        // Second priority: payment_pending
        if (!subData) {
          subData = allSubs.find(sub => sub.status === 'payment_pending');
        }
        
        // Third priority: any subscription
        if (!subData) {
          subData = allSubs[0];
        }
      }

      if (subError) throw subError;

      if (subData && subData.plan) {
        const planData = subData.plan as unknown as Plan;
        setSubscription({
          id: subData.id,
          status: subData.status,
          started_at: subData.started_at,
          expires_at: subData.expires_at,
          plan: {
            ...planData,
            features: Array.isArray(planData.features) ? planData.features : [],
          },
        });

        // Fetch current usage
        const [instancesRes, groupsRes, linksRes, campaignsRes] = await Promise.all([
          supabase.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("user_id", effectiveUserId),
          supabase.from("groups").select("id", { count: "exact", head: true }).eq("user_id", effectiveUserId),
          supabase.from("intelligent_links").select("id", { count: "exact", head: true }).eq("user_id", effectiveUserId),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("user_id", effectiveUserId)
            .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        ]);

        setLimits({
          instances: { current: instancesRes.count || 0, max: planData.max_instances },
          groups: { current: groupsRes.count || 0, max: planData.max_groups },
          links: { current: linksRes.count || 0, max: planData.max_links },
          campaigns: { current: campaignsRes.count || 0, max: planData.max_campaigns_month },
        });
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkLimit = (type: keyof UsageLimits): { allowed: boolean; message: string } => {
    // Lifetime admin has no limits
    if (isLifetimeAdmin) return { allowed: true, message: "" };
    
    if (!limits) return { allowed: true, message: "" };

    const limit = limits[type];
    if (limit.max === null) return { allowed: true, message: "" };

    if (limit.current >= limit.max) {
      const typeNames: Record<keyof UsageLimits, string> = {
        instances: "instâncias",
        groups: "grupos",
        links: "links",
        campaigns: "campanhas este mês",
      };
      return {
        allowed: false,
        message: `Você atingiu o limite de ${limit.max} ${typeNames[type]}. Faça upgrade do seu plano para continuar.`,
      };
    }

    return { allowed: true, message: "" };
  };

  const isFeatureAllowed = (feature: string): boolean => {
    // Lifetime admin has all features
    if (isLifetimeAdmin) return true;
    if (!subscription) return false;
    return subscription.plan.features.includes(feature);
  };

  // Lifetime admin never has payment/suspension issues
  const isSuspended = isLifetimeAdmin ? false : (subscription?.status === "suspended" || subscription?.status === "cancelled");
  const isPaymentPending = isLifetimeAdmin ? false : subscription?.status === "payment_pending";
  
  const isTrialExpired = isLifetimeAdmin ? false : (subscription?.status === "trial" && 
    subscription.expires_at && 
    new Date(subscription.expires_at) < new Date());

  // Check if subscription is expired (not yet suspended but past expiration)
  const isExpired = isLifetimeAdmin ? false : (subscription?.expires_at && 
    new Date(subscription.expires_at) < new Date() &&
    !["suspended", "cancelled"].includes(subscription.status));

  // Calculate days until suspension (3 days grace period)
  const getDaysUntilSuspension = (): number | null => {
    if (isLifetimeAdmin) return null; // Lifetime admin never gets suspended
    if (!subscription?.expires_at || isSuspended) return null;
    const expiresAt = new Date(subscription.expires_at);
    const now = new Date();
    if (expiresAt > now) return null; // Not expired yet
    
    const daysSinceExpiry = Math.floor((now.getTime() - expiresAt.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = 3 - daysSinceExpiry;
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  // User needs to pay urgently - never for lifetime admin
  const requiresPayment = isLifetimeAdmin ? false : (isExpired || isPaymentPending || isTrialExpired);

  return {
    subscription,
    limits,
    loading,
    checkLimit,
    isFeatureAllowed,
    isSuspended,
    isPaymentPending,
    isTrialExpired,
    isExpired,
    requiresPayment,
    getDaysUntilSuspension,
    refetch: fetchSubscription,
  };
}
