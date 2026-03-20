import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "4") {
    const bodyText = new TextEncoder().encode("<html><body><h1>Type 4 Uint8Array</h1></body></html>");
    return new Response(bodyText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response("Default", { headers: corsHeaders });
});
