import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - permitir acesso de qualquer origem para redirecionamento público
// mas com headers restritos
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Input validation
function isValidSlug(slug: string | null): boolean {
  if (!slug) return false;
  // Slug deve ser alfanumérico com hífen/underscore, max 100 chars
  return /^[a-zA-Z0-9_-]{1,100}$/.test(slug);
}

// Sanitize text to prevent XSS in HTML output
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

// Validate URL format
function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Bot detection function
// Returns true if the user agent appears to be a bot/crawler
// Note: FB_IAB, FBAV, IABMV are real users in Facebook/Instagram apps, NOT bots
function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  
  // First check if it's a real user in Facebook/Instagram in-app browser
  // These are NOT bots - they are real humans using the social media apps
  if (/FB_IAB|FBAV|IABMV/i.test(userAgent)) {
    return false;
  }
  
  const botPatterns = [
    /facebookexternalhit/i,  // Facebook crawler for link previews
    /facebot/i,              // Facebook bot
    /googlebot/i,            // Google crawler
    /bingbot/i,              // Bing crawler
    /whatsapp/i,             // WhatsApp link preview crawler
    /twitterbot/i,           // Twitter/X crawler
    /linkedinbot/i,          // LinkedIn crawler
    /slurp/i,                // Yahoo crawler
    /crawler/i,              // Generic crawler
    /spider/i,               // Generic spider
    /\bbot\b/i,              // Generic bot (word boundary to avoid "robot")
    /headless/i,             // Headless browsers
    /phantom/i,              // PhantomJS
    /puppeteer/i,            // Puppeteer
    /selenium/i,             // Selenium
    /curl/i,                 // curl requests
    /wget/i,                 // wget requests
    /python-requests/i,      // Python requests library
    /axios/i,                // Axios HTTP client
    /node-fetch/i,           // Node fetch
    /go-http-client/i,       // Go HTTP client
    /java\//i,               // Java HTTP client
    /libwww-perl/i,          // Perl LWP
    /pinterestbot/i,         // Pinterest crawler
    /discordbot/i,           // Discord crawler
    /telegrambot/i,          // Telegram crawler
    /slackbot/i,             // Slack crawler
    /viberbot/i,             // Viber crawler
    /skypebot/i,             // Skype crawler
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

// Generate OG Meta Tags HTML for crawlers/bots
// This provides dynamic preview for social media shares
function generateBotMetaTagsPage(link: {
  title?: string | null;
  name: string;
  landing_description?: string | null;
  logo_url?: string | null;
  slug: string;
}): string {
  const title = escapeHtml(link.title || link.name || 'VIPSend');
  const description = escapeHtml(link.landing_description || 'Entre no grupo pelo VIPSend - Automação inteligente de WhatsApp');
  const imageUrl = link.logo_url && isValidUrl(link.logo_url) 
    ? link.logo_url 
    : 'https://grupo-wa.lovable.app/og-image.png';
  const canonicalUrl = `https://grupo-wa.lovable.app/go/${encodeURIComponent(link.slug)}`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="VIPSend" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <!-- WhatsApp specific -->
  <meta property="og:image:alt" content="${title}" />
  
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`;
}

// Optimized WhatsApp Deep Link generator for direct app opening
function getOptimizedWhatsAppUrl(inviteLink: string, userAgent: string): string {
  // Validate URL first
  if (!isValidUrl(inviteLink)) {
    console.warn('Invalid invite link URL:', inviteLink);
    return inviteLink;
  }

  // Only optimize chat.whatsapp.com links
  if (!inviteLink.includes("chat.whatsapp.com/")) {
    return inviteLink;
  }

  const inviteCode = inviteLink.replace(/^https?:\/\/chat\.whatsapp\.com\//, "");
  
  // Validate invite code format (alphanumeric, max 50 chars)
  if (!/^[a-zA-Z0-9]{1,50}$/.test(inviteCode)) {
    console.warn('Invalid invite code format:', inviteCode);
    return inviteLink;
  }
  
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  
  // CRITICAL: Detect Facebook/Instagram in-app browsers
  // These browsers block WhatsApp deep links - we'll handle them specially
  const isSocialInAppBrowser = /FB_IAB|FBAV|FBAN|Instagram|IABMV/i.test(userAgent);
  
  if (isSocialInAppBrowser) {
    // For social in-app browsers: just return the universal link
    // We'll use a special HTML page to help the user open in external browser
    console.log(`Social in-app browser detected (FB/IG), using universal link for: ${inviteCode}`);
    return inviteLink;
  }
  
  if (isAndroid) {
    // Intent URI for Android - forces app to open directly
    // Falls back to original URL if WhatsApp is not installed
    // Only use for regular browsers (Chrome, Firefox, Samsung, etc.)
    return `intent://invite/${inviteCode}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(inviteLink)};end;`;
  } else if (isIOS) {
    // Universal Link works well on iOS from Safari
    return inviteLink;
  } else {
    // Desktop - WhatsApp Web with invite code
    return `https://web.whatsapp.com/accept?code=${inviteCode}`;
  }
}

// Check if user is in a social media in-app browser (FB/IG)
function isSocialInAppBrowser(userAgent: string): boolean {
  return /FB_IAB|FBAV|FBAN|Instagram|IABMV/i.test(userAgent);
}

// Generate HTML page that helps user escape the in-app browser
// IMPORTANT: NO JavaScript auto-redirect - it causes white screen in Instagram/Facebook browsers
// PIXEL TRACKING: Only fires when user clicks the button, not on page load
function generateInAppBrowserEscapePage(redirectUrl: string, linkTitle: string, pixelId: string | null, pixelEvent: string): string {
  // Generate pixel initialization script (without auto-track)
  const pixelInitScript = pixelId ? `
    <script>
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      // Note: PageView is NOT tracked on load - only when user clicks the button
    </script>
  ` : '';
  
  // Generate onclick handler that tracks pixel event before redirect
  const onClickHandler = pixelId 
    ? `onclick="if(typeof fbq==='function'){fbq('track','${pixelEvent}');}return true;"`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(linkTitle) || 'Entrar no Grupo'}</title>
  ${pixelInitScript}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 400px; width: 100%; }
    .whatsapp-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    p { opacity: 0.9; margin-bottom: 1.5rem; line-height: 1.5; font-size: 0.95rem; }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      background: white;
      color: #128C7E;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .hint {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-top: 1.5rem;
      line-height: 1.4;
    }
    .dots {
      display: inline-block;
      margin: 0 4px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="whatsapp-icon" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
    <h1>Entrar no Grupo WhatsApp</h1>
    <p>Toque no botão abaixo para abrir o WhatsApp e entrar no grupo:</p>
    <a href="${redirectUrl}" class="btn" ${onClickHandler}>
      ✓ Abrir WhatsApp
    </a>
    <p class="hint">
      Se não funcionar, toque nos <span class="dots">⋯</span> no canto superior e selecione <strong>"Abrir no navegador"</strong>
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests for redirect
  if (req.method !== "GET") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    
    // Support slug via query param OR via path (for direct Vercel rewrite)
    // Path format: /smart-redirect/update or /smart-redirect?slug=update
    let slug = url.searchParams.get("slug");
    
    // Also check if slug is in the path (e.g., /smart-redirect/my-slug)
    if (!slug) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        slug = pathParts[pathParts.length - 1];
      }
    }
    
    const formatJson = url.searchParams.get("format") === "json";

    // Validate slug format
    if (!isValidSlug(slug)) {
      console.warn('Invalid slug format:', slug);
      return new Response("Link não encontrado", { 
        status: 404,
        headers: corsHeaders
      });
    }

    console.log(`Smart redirect for slug: ${slug}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the intelligent link
    const { data: link, error: linkError } = await supabase
      .from("intelligent_links")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (linkError || !link) {
      console.log("Link not found:", slug);
      return new Response("Link não encontrado ou inativo", { status: 404 });
    }

    // Get visitor info early for bot detection
    const userAgent = req.headers.get("user-agent") || "";
    
    // CRITICAL: Check if this is a bot/crawler FIRST
    // If it's a bot, return static HTML with OG meta tags and exit early
    // This provides proper previews for Facebook, Instagram, WhatsApp, etc.
    const isBotRequest = isBot(userAgent);
    if (isBotRequest) {
      console.log(`Bot detected (${userAgent.substring(0, 50)}...), serving OG meta tags for: ${slug}`);
      const metaTagsPage = generateBotMetaTagsPage({
        title: link.title,
        name: link.name,
        landing_description: link.landing_description,
        logo_url: link.logo_url,
        slug: link.slug,
      });
      return new Response(metaTagsPage, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour for bots
        }
      });
    }

    // Get Pixel ID from user_pixels table if link has pixel_id reference
    let pixelId: string | null = null;
    if (link.pixel_id) {
      const { data: userPixel } = await supabase
        .from("user_pixels")
        .select("pixel_id")
        .eq("id", link.pixel_id)
        .single();
      
      pixelId = userPixel?.pixel_id || null;
    }
    
    // Fallback: Get user's global default Pixel from user_pixels table
    if (!pixelId) {
      const { data: defaultPixel } = await supabase
        .from("user_pixels")
        .select("pixel_id")
        .eq("user_id", link.user_id)
        .eq("is_default", true)
        .single();
      
      pixelId = defaultPixel?.pixel_id || null;
    }
    
    // Legacy fallback: check profile's facebook_pixel_id
    if (!pixelId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("facebook_pixel_id")
        .eq("id", link.user_id)
        .single();
      
      pixelId = profile?.facebook_pixel_id || null;
    }
    const pixelEvent = link.facebook_pixel_event || "PageView";

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      console.log("Link expired:", slug);
      return new Response("Link expirado", { status: 410 });
    }

    // Get additional visitor info (userAgent already defined above for bot check)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || 
               req.headers.get("cf-connecting-ip") || 
               "unknown";
    const referer = req.headers.get("referer") || "";
    
    // Detect if mobile for optimized redirect
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);

    // Parse UTM parameters
    const utmSource = url.searchParams.get("utm_source");
    const utmMedium = url.searchParams.get("utm_medium");
    const utmCampaign = url.searchParams.get("utm_campaign");
    const utmContent = url.searchParams.get("utm_content");

    let redirectUrl = link.redirect_url || "https://wa.me/";
    let selectedGroupId: string | null = null;
    let selectedManualGroupId: string | null = null;
    let selectedPhoneNumberId: string | null = null;

    // Check link mode
    if (link.mode === "direct_chat") {
      // Direct chat mode: redirect to wa.me/{phone}?text={message}
      const { data: phoneNumbers, error: phonesError } = await supabase
        .from("link_phone_numbers")
        .select("*")
        .eq("link_id", link.id)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (phonesError) {
        console.error("Error fetching phone numbers:", phonesError);
        throw new Error("Erro ao buscar números");
      }

      console.log(`Found ${phoneNumbers?.length || 0} active phone numbers for ${slug}`);

      if (phoneNumbers && phoneNumbers.length > 0) {
        // Sort by click count (fewer clicks first) for balanced distribution
        const sortedPhones = [...phoneNumbers].sort((a, b) => {
          const clicksA = a.current_clicks || 0;
          const clicksB = b.current_clicks || 0;
          
          if (clicksA !== clicksB) {
            return clicksA - clicksB;
          }
          
          // Tie-breaker: use priority
          return a.priority - b.priority;
        });

        const selectedPhone = sortedPhones[0];
        selectedPhoneNumberId = selectedPhone.id;

        // Build wa.me URL
        const phoneNumber = selectedPhone.phone_number;
        const defaultMessage = link.default_message || "";
        
        if (defaultMessage) {
          redirectUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
        } else {
          redirectUrl = `https://wa.me/${phoneNumber}`;
        }

        // Increment click count for phone number (async, don't wait)
        supabase
          .from("link_phone_numbers")
          .update({ 
            current_clicks: (selectedPhone.current_clicks || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedPhone.id)
          .then(() => console.log(`Updated click count for phone ${selectedPhone.internal_name}`));

        console.log(`Redirecting to direct chat: ${selectedPhone.internal_name} (${phoneNumber})`);
      }
    } else if (link.mode === "connected") {
      // Connected mode: use synced groups from link_groups table
      const { data: linkGroups, error: groupsError } = await supabase
        .from("link_groups")
        .select(`
          *,
          groups (
            id,
            name,
            invite_link,
            member_count,
            max_members,
            participants_count,
            is_active
          )
        `)
        .eq("link_id", link.id)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (groupsError) {
        console.error("Error fetching link groups:", groupsError);
        throw new Error("Erro ao buscar grupos");
      }

      // Filter active groups with valid invite links
      const capacityLimit = link.capacity_limit || 1000;
      const allActiveGroups = linkGroups?.filter(lg => 
        lg.groups?.is_active && lg.groups?.invite_link
      ) || [];

      // Try to find groups with available capacity first
      const groupsWithCapacity = allActiveGroups.filter(lg => {
        const currentCount = lg.groups.participants_count ?? lg.groups.member_count;
        const maxAllowed = Math.min(lg.groups.max_members, capacityLimit);
        return currentCount < maxAllowed;
      });

      console.log(`Found ${allActiveGroups.length} active groups, ${groupsWithCapacity.length} with capacity for ${slug}`);

      // If some groups have capacity, use only those; otherwise use all groups (round-robin)
      const availableGroups = groupsWithCapacity.length > 0 ? groupsWithCapacity : allActiveGroups;

      if (availableGroups.length > 0) {
        // Get total clicks per group to determine which group should receive next click
        const { data: clickStats } = await supabase
          .from("link_clicks")
          .select("group_id")
          .eq("link_id", link.id)
          .not("group_id", "is", null);
        
        // Count clicks per group
        const clickCounts: Record<string, number> = {};
        clickStats?.forEach(click => {
          if (click.group_id) {
            clickCounts[click.group_id] = (clickCounts[click.group_id] || 0) + 1;
          }
        });

        // Calculate ideal distribution (equal clicks per group)
        const totalClicks = Object.values(clickCounts).reduce((a, b) => a + b, 0);
        const idealClicksPerGroup = totalClicks / availableGroups.length;

        // Sort groups by: 1) those below ideal click count first, 2) then by priority
        const sortedGroups = [...availableGroups].sort((a, b) => {
          const clicksA = clickCounts[a.groups.id] || 0;
          const clicksB = clickCounts[b.groups.id] || 0;
          
          // Groups with fewer clicks than ideal get priority
          const belowIdealA = clicksA < idealClicksPerGroup;
          const belowIdealB = clicksB < idealClicksPerGroup;
          
          if (belowIdealA && !belowIdealB) return -1;
          if (!belowIdealA && belowIdealB) return 1;
          
          // If both are below/above ideal, sort by click count (fewer first)
          if (clicksA !== clicksB) {
            return clicksA - clicksB;
          }
          
          // Tie-breaker: use priority
          return a.priority - b.priority;
        });

        const selectedLinkGroup = sortedGroups[0];
        redirectUrl = selectedLinkGroup.groups.invite_link;
        selectedGroupId = selectedLinkGroup.groups.id;

        const groupClicks = clickCounts[selectedLinkGroup.groups.id] || 0;
        console.log(`Redirecting to connected group: ${selectedLinkGroup.groups.name} (clicks: ${groupClicks}, ideal: ${idealClicksPerGroup.toFixed(1)}, total groups: ${availableGroups.length})`);
      } else {
        // Check for reserve group
        if (link.reserve_group_id) {
          const { data: reserveGroup } = await supabase
            .from("groups")
            .select("id, invite_link, member_count, max_members, participants_count")
            .eq("id", link.reserve_group_id)
            .single();

          if (reserveGroup?.invite_link) {
            const currentCount = reserveGroup.participants_count ?? reserveGroup.member_count;
            if (currentCount < reserveGroup.max_members) {
              redirectUrl = reserveGroup.invite_link;
              selectedGroupId = link.reserve_group_id;
              console.log("Using reserve group");
            }
          }
        }
      }
    } else if (link.mode === "manual") {
      // Manual mode: use external invite URLs from link_manual_groups
      const { data: manualGroups, error: manualError } = await supabase
        .from("link_manual_groups")
        .select("*")
        .eq("link_id", link.id)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (manualError) {
        console.error("Error fetching manual groups:", manualError);
        throw new Error("Erro ao buscar grupos manuais");
      }

      // Filter groups that haven't hit click limit
      const availableManualGroups = manualGroups?.filter(mg => 
        mg.current_clicks < mg.click_limit
      ) || [];

      console.log(`Found ${availableManualGroups.length} available manual groups for ${slug}`);

      if (availableManualGroups.length > 0) {
        // Round-robin based on click ratio
        const sortedGroups = [...availableManualGroups].sort((a, b) => {
          const ratioA = a.current_clicks / a.click_limit;
          const ratioB = b.current_clicks / b.click_limit;
          
          // If ratios are similar, use priority
          if (Math.abs(ratioA - ratioB) < 0.05) {
            return a.priority - b.priority;
          }
          
          return ratioA - ratioB;
        });

        const selectedManualGroup = sortedGroups[0];
        redirectUrl = selectedManualGroup.invite_url;
        selectedManualGroupId = selectedManualGroup.id;

        // Increment click count for manual group (async, don't wait)
        supabase
          .from("link_manual_groups")
          .update({ current_clicks: selectedManualGroup.current_clicks + 1 })
          .eq("id", selectedManualGroup.id)
          .then(() => console.log(`Updated click count for ${selectedManualGroup.internal_name}`));

        console.log(`Redirecting to manual group: ${selectedManualGroup.internal_name}`);
      }
    }

    // If no groups/phones available, show no vacancy message or use fallback
    if (!selectedGroupId && !selectedManualGroupId && !selectedPhoneNumberId && !link.redirect_url) {
      const noVacancyMessage = link.no_vacancy_message || "Sem vagas no momento. Tente novamente mais tarde.";
      console.log("No available groups, showing no vacancy message");
      
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${link.title || link.name}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container { max-width: 400px; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; }
            p { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${link.title || link.name}</h1>
            <p>${noVacancyMessage}</p>
          </div>
        </body>
        </html>
      `, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Detect if this is a bot/crawler click
    const isBotClick = isBot(userAgent);
    
    // Record click asynchronously (don't wait for it to complete)
    supabase.from("link_clicks").insert({
      link_id: link.id,
      group_id: selectedGroupId,
      manual_group_id: selectedManualGroupId,
      phone_number_id: selectedPhoneNumberId,
      ip_address: ip,
      user_agent: userAgent,
      referer: referer,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      is_bot: isBotClick,
    }).then(() => console.log(`Click recorded (bot: ${isBotClick})`));

    // Update click count asynchronously
    supabase
      .from("intelligent_links")
      .update({ click_count: link.click_count + 1 })
      .eq("id", link.id)
      .then(() => console.log("Link click count updated"));

    // Optimize redirect URL for direct WhatsApp app opening
    const optimizedUrl = getOptimizedWhatsAppUrl(redirectUrl, userAgent);
    const isAndroid = /android/i.test(userAgent);
    
    console.log(`Redirecting to: ${redirectUrl} -> ${optimizedUrl} (android: ${isAndroid}, mobile: ${isMobile})`);

    // If JSON format is requested, return data for frontend to handle redirect
    if (formatJson) {
      return new Response(JSON.stringify({
        success: true,
        redirectUrl: optimizedUrl,
        originalUrl: redirectUrl,
        pixelId: pixelId || null,
        pixelEvent: pixelEvent,
        landingPage: link.show_landing_page ? {
          title: link.title,
          description: link.landing_description,
          logoUrl: link.logo_url,
        } : null,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Generate Facebook Pixel script if configured
    const generatePixelScript = (pixelId: string, event: string) => {
      return `
        <!-- Facebook Pixel Code -->
        <script>
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', '${event}');
        </script>
        <noscript><img height="1" width="1" style="display:none"
          src="https://www.facebook.com/tr?id=${pixelId}&ev=${event}&noscript=1"
        /></noscript>
        <!-- End Facebook Pixel Code -->
      `;
    };

    const pixelScript = pixelId 
      ? generatePixelScript(pixelId, pixelEvent)
      : '';

    // Check if we should show a landing page first
    // Only show if explicitly configured AND all fields are present AND skipLanding is not set
    const skipLanding = url.searchParams.get("skipLanding") === "true";
    const hasLandingPage = link.title && link.landing_description && !skipLanding;
    
    if (hasLandingPage) {
      // Show landing page with fast auto-redirect (1.5s instead of 3s)
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${link.title || link.name}</title>
          <meta http-equiv="refresh" content="1;url=${optimizedUrl}">
          ${pixelScript}
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container { max-width: 400px; }
            .logo { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem; object-fit: cover; }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { opacity: 0.9; margin-bottom: 1rem; }
            .spinner { 
              width: 20px; 
              height: 20px; 
              border: 2px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 0 auto;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            a { 
              color: white; 
              text-decoration: underline;
              font-size: 0.75rem;
              margin-top: 0.5rem;
              display: inline-block;
              opacity: 0.8;
            }
          </style>
          <script>
            // Immediate redirect via JS for faster experience
            setTimeout(function() {
              window.location.href = "${optimizedUrl}";
            }, 800);
          </script>
        </head>
        <body>
          <div class="container">
            ${link.logo_url ? `<img src="${link.logo_url}" alt="Logo" class="logo">` : ''}
            <h1>${link.title || link.name}</h1>
            ${link.landing_description ? `<p>${link.landing_description}</p>` : ''}
            <div class="spinner"></div>
            <a href="${optimizedUrl}">Toque aqui se não for redirecionado</a>
          </div>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }
      });
    }

    // CRITICAL: Handle Facebook/Instagram in-app browsers FIRST
    // These browsers block automatic WhatsApp deep links and don't render 
    // JavaScript redirects properly, so we MUST show a page with a manual button
    // This check must come BEFORE the pixel check to avoid HTML rendering issues
    if (isSocialInAppBrowser(userAgent)) {
      console.log("Serving in-app browser escape page for social media user (priority check)");
      const escapePage = generateInAppBrowserEscapePage(redirectUrl, link.title || link.name, pixelId, pixelEvent);
      return new Response(escapePage, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }
      });
    }

    // If pixel is configured but no landing page, show a minimal redirect page with pixel
    // This only runs for regular browsers (not in-app browsers from social media)
    if (pixelId) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redirecionando...</title>
          <meta http-equiv="refresh" content="0;url=${optimizedUrl}">
          ${pixelScript}
          <script>
            // Immediate redirect
            window.location.href = "${optimizedUrl}";
          </script>
        </head>
        <body style="background:#25D366;display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <p style="color:white;font-family:sans-serif;">Redirecionando...</p>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }
      });
    }

    // FAST Direct redirect - HTTP 302 (no pixel configured, regular browser)
    return new Response(null, {
      status: 302,
      headers: {
        "Location": optimizedUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Smart redirect error:", error);
    return new Response("Erro interno", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
