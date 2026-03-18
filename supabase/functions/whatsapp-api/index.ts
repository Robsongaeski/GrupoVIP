import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== INTERFACES ====================

interface WhatsAppConfig {
  provider: "evolution" | "uazapi";
  baseUrl: string;
  apiKey: string;
  adminToken?: string;
}

interface CreateInstanceResponse {
  success: boolean;
  instanceName?: string;
  instanceToken?: string; // UAZAPI returns a unique token per instance
  data?: any;
  error?: string;
}

interface ConnectResponse {
  success: boolean;
  qrcode?: string;
  status?: string;
  message?: string;
}

interface StatusResponse {
  success: boolean;
  status: "connected" | "disconnected" | "connecting" | "qr_pending";
  phoneNumber?: string;
  raw?: any;
}

interface SendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
}

interface Group {
  id: string;
  subject: string;
  desc?: string;
  participants?: any[];
  size?: number;
  inviteCode?: string;
}

interface MediaPayload {
  type: "image" | "video" | "document" | "audio";
  url: string;
  caption?: string;
  filename?: string;
}

interface PollPayload {
  question: string;
  options: string[];
  allowMultiple: boolean;
}

// ==================== ADAPTER INTERFACE ====================

interface IWhatsAppAdapter {
  // Instance operations
  createInstance(name: string): Promise<CreateInstanceResponse>;
  deleteInstance(name: string): Promise<{ success: boolean }>;
  connectInstance(name: string): Promise<ConnectResponse>;
  getInstanceStatus(name: string): Promise<StatusResponse>;
  logoutInstance(name: string): Promise<{ success: boolean }>;
  
  // Message operations
  sendTextMessage(instanceName: string, groupId: string, text: string): Promise<SendResponse>;
  sendMediaMessage(instanceName: string, groupId: string, media: MediaPayload): Promise<SendResponse>;
  sendPollMessage(instanceName: string, groupId: string, poll: PollPayload): Promise<SendResponse>;
  
  // Group operations
  fetchGroups(instanceName: string, getParticipants?: boolean): Promise<Group[]>;
  getInviteCode(instanceName: string, groupId: string): Promise<string | null>;
  
  // Test
  testConnection(): Promise<{ success: boolean; message: string; instanceCount?: number }>;
  
  // Get phone number from connected instance
  getInstancePhoneNumber(instanceName: string): Promise<string | null>;

  // Configure instance settings (anti-phantom)
  configureInstanceSettings(name: string): Promise<{ success: boolean; error?: string }>;
}

// ==================== EVOLUTION API ADAPTER ====================

class EvolutionAdapter implements IWhatsAppAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: WhatsAppConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "apikey": this.apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    };
    
    return fetch(url, { ...options, headers });
  }

  async createInstance(name: string): Promise<CreateInstanceResponse> {
    const response = await this.request("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        syncFullHistory: false,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      let errorMessage = "Erro ao criar instância";
      if (data.response?.message) {
        errorMessage = Array.isArray(data.response.message) 
          ? data.response.message.join(", ") 
          : data.response.message;
      } else if (data.message) {
        errorMessage = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }
      return { success: false, error: errorMessage };
    }

    // Auto-configure settings after creation to prevent phantom messages
    try {
      await this.configureInstanceSettings(name);
      console.log(`Instance ${name} settings configured automatically`);
    } catch (err) {
      console.error(`Failed to auto-configure settings for ${name}:`, err);
    }

    return { success: true, instanceName: name, data };
  }

  async configureInstanceSettings(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.request(`/settings/set/${name}`, {
        method: "PUT",
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
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.message || `HTTP ${response.status}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async deleteInstance(name: string): Promise<{ success: boolean }> {
    await this.request(`/instance/delete/${name}`, { method: "DELETE" });
    return { success: true };
  }

  async connectInstance(name: string): Promise<ConnectResponse> {
    const response = await this.request(`/instance/connect/${name}`, { method: "GET" });
    const data = await response.json();

    if (data.instance?.state === "open") {
      // Re-apply settings on reconnect to prevent phantom messages
      try {
        await this.configureInstanceSettings(name);
        console.log(`Instance ${name} settings re-applied on reconnect`);
      } catch (err) {
        console.error(`Failed to re-apply settings for ${name} on reconnect:`, err);
      }
      return { success: true, status: "connected", message: "Já conectado!" };
    }

    let qrCodeBase64 = null;
    if (data.base64) {
      qrCodeBase64 = data.base64.replace(/^data:image\/\w+;base64,/, "");
    } else if (data.qrcode?.base64) {
      qrCodeBase64 = data.qrcode.base64.replace(/^data:image\/\w+;base64,/, "");
    }

    return {
      success: true,
      qrcode: qrCodeBase64 || undefined,
      status: data.instance?.state || "qr_pending",
    };
  }

  async getInstanceStatus(name: string): Promise<StatusResponse> {
    const response = await this.request(`/instance/connectionState/${name}`, { method: "GET" });
    const data = await response.json();

    if (!response.ok || data.error || data.message?.includes("not found")) {
      return { success: false, status: "disconnected", raw: data };
    }

    let status: StatusResponse["status"] = "disconnected";
    if (data.instance?.state === "open") status = "connected";
    else if (data.instance?.state === "connecting") status = "connecting";
    else if (data.instance?.state === "close") status = "disconnected";

    return { success: true, status, raw: data };
  }

  async logoutInstance(name: string): Promise<{ success: boolean }> {
    await this.request(`/instance/logout/${name}`, { method: "DELETE" });
    return { success: true };
  }

  async sendTextMessage(instanceName: string, groupId: string, text: string): Promise<SendResponse> {
    const response = await this.request(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ number: groupId, text }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.key?.id,
      error: response.ok ? undefined : (data.message || "Erro ao enviar"),
      raw: data,
    };
  }

  async sendMediaMessage(instanceName: string, groupId: string, media: MediaPayload): Promise<SendResponse> {
    const endpoint = media.type === "audio" ? "sendWhatsAppAudio" : "sendMedia";
    
    const body: any = {
      number: groupId,
      mediatype: media.type,
      media: media.url,
    };
    if (media.caption) body.caption = media.caption;
    if (media.filename) body.fileName = media.filename;

    const response = await this.request(`/message/${endpoint}/${instanceName}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.key?.id,
      error: response.ok ? undefined : (data.message || "Erro ao enviar mídia"),
      raw: data,
    };
  }

  async sendPollMessage(instanceName: string, groupId: string, poll: PollPayload): Promise<SendResponse> {
    const response = await this.request(`/message/sendPoll/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: groupId,
        name: poll.question,
        values: poll.options,
        selectableCount: poll.allowMultiple ? poll.options.length : 1,
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.key?.id,
      error: response.ok ? undefined : (data.message || "Erro ao enviar enquete"),
      raw: data,
    };
  }

  async fetchGroups(instanceName: string, getParticipants = true): Promise<Group[]> {
    const response = await this.request(
      `/group/fetchAllGroups/${instanceName}?getParticipants=${getParticipants}`,
      { method: "GET" }
    );

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((g: any) => ({
      id: g.id,
      subject: g.subject || g.name || "Grupo sem nome",
      desc: g.desc,
      participants: g.participants,
      size: g.size || g.participants?.length,
      inviteCode: g.inviteCode,
    }));
  }

  async getInviteCode(instanceName: string, groupId: string): Promise<string | null> {
    try {
      const response = await this.request(
        `/group/inviteCode/${instanceName}?groupJid=${encodeURIComponent(groupId)}`,
        { method: "GET" }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.inviteCode || data.code || null;
    } catch {
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; instanceCount?: number }> {
    try {
      const response = await this.request("/instance/fetchInstances", { method: "GET" });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.message || `Erro HTTP ${response.status}` };
      }

      const data = await response.json();
      const count = Array.isArray(data) ? data.length : 0;
      return { success: true, message: `Conexão bem sucedida! ${count} instâncias encontradas.`, instanceCount: count };
    } catch (error) {
      return { success: false, message: `Erro de conexão: ${(error as Error).message}` };
    }
  }

  async getInstancePhoneNumber(instanceName: string): Promise<string | null> {
    try {
      const response = await this.request("/instance/fetchInstances", { method: "GET" });
      if (!response.ok) return null;

      const instances = await response.json();
      if (!Array.isArray(instances)) return null;

      const instance = instances.find((inst: any) => 
        inst.instance?.instanceName === instanceName ||
        inst.instanceName === instanceName ||
        inst.name === instanceName
      );

      if (!instance) return null;

      const owner = instance.instance?.owner || instance.owner || instance.instance?.ownerJid || instance.ownerJid;
      return owner ? owner.split("@")[0].replace(/\D/g, "") : null;
    } catch {
      return null;
    }
  }
}

// ==================== UAZAPI ADAPTER ====================
// Based on official UAZAPI GO OpenAPI documentation

class UazapiAdapter implements IWhatsAppAdapter {
  private baseUrl: string;
  private adminToken: string;

  constructor(config: WhatsAppConfig) {
    // UAZAPI uses subdomain-based URLs: https://{subdomain}.uazapi.com
    // Clean up the baseUrl - remove protocol and domain suffix if present
    let subdomain = config.baseUrl
      .replace(/https?:\/\//, "")
      .replace(".uazapi.com", "")
      .replace(/\//g, "")
      .trim();
    
    // If it's still empty or contains full URL parts, extract subdomain
    if (subdomain.includes(".")) {
      subdomain = subdomain.split(".")[0];
    }
    
    this.baseUrl = `https://${subdomain}.uazapi.com`;
    this.adminToken = config.adminToken || config.apiKey;
    
    console.log("UazapiAdapter initialized with baseUrl:", this.baseUrl);
  }

  // Request with admin token (for /instance/all, /instance/init)
  private async requestWithAdminToken(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "admintoken": this.adminToken,
      ...options.headers as Record<string, string>,
    };
    
    console.log(`UAZAPI Admin Request: ${options.method || 'GET'} ${url}`);
    
    return fetch(url, { ...options, headers });
  }

  // Request with instance token (for instance-specific operations)
  private async requestWithInstanceToken(instanceToken: string, endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "token": instanceToken,
      ...options.headers as Record<string, string>,
    };
    
    console.log(`UAZAPI Instance Request: ${options.method || 'GET'} ${url}`);
    
    return fetch(url, { ...options, headers });
  }

  // Legacy request method for backward compatibility
  private async request(endpoint: string, options: RequestInit = {}, useAdminToken = true): Promise<Response> {
    if (useAdminToken) {
      return this.requestWithAdminToken(endpoint, options);
    }
    return fetch(`${this.baseUrl}${endpoint}`, { 
      ...options, 
      headers: { "Content-Type": "application/json", ...options.headers as Record<string, string> }
    });
  }

  async createInstance(name: string): Promise<CreateInstanceResponse> {
    // UAZAPI uses POST /instance/init to create instances
    // Documentation: Creates a new instance and returns a unique token
    const response = await this.requestWithAdminToken("/instance/init", {
      method: "POST",
      body: JSON.stringify({
        instanceName: name,
      }),
    });

    const data = await response.json();
    console.log("UAZAPI createInstance response:", JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || data.error || "Erro ao criar instância" };
    }

    // UAZAPI returns a unique token for each instance
    // This token must be stored and used for all instance-specific operations
      return { 
      success: true, 
      instanceName: name, 
      instanceToken: data.token, // Important: save this token!
      data 
    };
  }

  async configureInstanceSettings(_name: string): Promise<{ success: boolean; error?: string }> {
    // UAZAPI does not support settings/set endpoint - no-op
    return { success: true };
  }

  async deleteInstance(name: string): Promise<{ success: boolean }> {
    await this.request(`/instance/delete/${name}`, { method: "DELETE" });
    return { success: true };
  }

  async connectInstance(name: string): Promise<ConnectResponse> {
    const response = await this.request(`/instance/connect/${name}`, { method: "GET" });
    const data = await response.json();

    // Check if already connected
    if (data.status === "CONNECTED" || data.state === "open") {
      return { success: true, status: "connected", message: "Já conectado!" };
    }

    // Extract QR code - UAZAPI may return it differently
    let qrCodeBase64 = null;
    if (data.qrcode) {
      qrCodeBase64 = data.qrcode.replace(/^data:image\/\w+;base64,/, "");
    } else if (data.base64) {
      qrCodeBase64 = data.base64.replace(/^data:image\/\w+;base64,/, "");
    }

    return {
      success: true,
      qrcode: qrCodeBase64 || undefined,
      status: qrCodeBase64 ? "qr_pending" : "connecting",
    };
  }

  async getInstanceStatus(name: string): Promise<StatusResponse> {
    const response = await this.request(`/instance/status/${name}`, { method: "GET" });
    const data = await response.json();

    if (!response.ok) {
      return { success: false, status: "disconnected", raw: data };
    }

    let status: StatusResponse["status"] = "disconnected";
    const stateValue = data.status || data.state || "";
    
    if (stateValue === "CONNECTED" || stateValue === "open") status = "connected";
    else if (stateValue === "CONNECTING" || stateValue === "connecting") status = "connecting";
    else if (stateValue === "QRCODE" || stateValue === "qr_pending") status = "qr_pending";
    
    return { 
      success: true, 
      status, 
      phoneNumber: data.phoneNumber || data.phone,
      raw: data 
    };
  }

  async logoutInstance(name: string): Promise<{ success: boolean }> {
    await this.request(`/instance/logout/${name}`, { method: "POST" });
    return { success: true };
  }

  async sendTextMessage(instanceName: string, groupId: string, text: string): Promise<SendResponse> {
    // UAZAPI uses instance token in header, get it from the instance data
    const response = await this.request(`/message/text`, {
      method: "POST",
      body: JSON.stringify({ 
        phone: groupId,
        message: text,
        instanceName 
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.messageId || data.id,
      error: response.ok ? undefined : (data.message || data.error || "Erro ao enviar"),
      raw: data,
    };
  }

  async sendMediaMessage(instanceName: string, groupId: string, media: MediaPayload): Promise<SendResponse> {
    const response = await this.request(`/message/media`, {
      method: "POST",
      body: JSON.stringify({
        phone: groupId,
        mediaUrl: media.url,
        mediaType: media.type,
        caption: media.caption,
        fileName: media.filename,
        instanceName,
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.messageId || data.id,
      error: response.ok ? undefined : (data.message || data.error || "Erro ao enviar mídia"),
      raw: data,
    };
  }

  async sendPollMessage(instanceName: string, groupId: string, poll: PollPayload): Promise<SendResponse> {
    const response = await this.request(`/message/poll`, {
      method: "POST",
      body: JSON.stringify({
        phone: groupId,
        title: poll.question,
        options: poll.options,
        multiSelect: poll.allowMultiple,
        instanceName,
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.messageId || data.id,
      error: response.ok ? undefined : (data.message || data.error || "Erro ao enviar enquete"),
      raw: data,
    };
  }

  async fetchGroups(instanceName: string, _getParticipants = true): Promise<Group[]> {
    const response = await this.request(`/group/list?instanceName=${instanceName}`, { method: "GET" });

    const data = await response.json();
    if (!Array.isArray(data.groups || data)) return [];

    const groups = data.groups || data;
    return groups.map((g: any) => ({
      id: g.id || g.jid,
      subject: g.name || g.subject || "Grupo sem nome",
      desc: g.description || g.desc,
      participants: g.participants,
      size: g.participantsCount || g.size || g.participants?.length,
      inviteCode: g.inviteCode,
    }));
  }

  async getInviteCode(instanceName: string, groupId: string): Promise<string | null> {
    try {
      const response = await this.request(
        `/group/inviteCode?instanceName=${instanceName}&groupId=${encodeURIComponent(groupId)}`,
        { method: "GET" }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.inviteCode || data.code || null;
    } catch {
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; instanceCount?: number }> {
    try {
      console.log("UAZAPI testConnection - baseUrl:", this.baseUrl);
      
      // Try GET /instance/all with admintoken header (official endpoint)
      const response = await this.requestWithAdminToken("/instance/all", { method: "GET" });
      console.log("UAZAPI /instance/all response status:", response.status);
      
      const data = await response.json().catch(() => ({}));
      console.log("UAZAPI test connection data:", JSON.stringify(data));
      
      // Check if endpoint is disabled (free/demo server)
      if (data.error && (data.error.includes("disabled") || data.error.includes("demo"))) {
        console.log("UAZAPI: Demo server detected, endpoint disabled - this is OK");
        
        // On demo servers, /instance/all is disabled but the server is reachable
        // The fact that we got a response means the server is alive
        return { 
          success: true, 
          message: `Conexão UAZAPI estabelecida com ${this.baseUrl}. Servidor de demonstração ativo (alguns endpoints administrativos estão desativados).`,
          instanceCount: 0
        };
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        return { 
          success: false, 
          message: `Admin Token inválido ou sem permissão. Verifique as credenciais.` 
        };
      }
      
      if (!response.ok) {
        return { success: false, message: data.message || data.error || `Erro HTTP ${response.status}` };
      }

      // UAZAPI returns array of instances directly
      const instances = Array.isArray(data) ? data : (data.data || data.instances || []);
      const count = Array.isArray(instances) ? instances.length : 0;
      return { 
        success: true, 
        message: `Conexão UAZAPI bem sucedida! ${count} instância(s) encontrada(s).`, 
        instanceCount: count 
      };
    } catch (error) {
      console.log("UAZAPI test connection exception:", error);
      return { success: false, message: `Erro de conexão: ${(error as Error).message}` };
    }
  }

  async getInstancePhoneNumber(instanceName: string): Promise<string | null> {
    try {
      const statusResult = await this.getInstanceStatus(instanceName);
      return statusResult.phoneNumber || null;
    } catch {
      return null;
    }
  }
}

// ==================== ADAPTER FACTORY ====================

function createAdapter(config: WhatsAppConfig): IWhatsAppAdapter {
  switch (config.provider) {
    case "evolution":
      return new EvolutionAdapter(config);
    case "uazapi":
      return new UazapiAdapter(config);
    default:
      throw new Error(`Provider não suportado: ${config.provider}`);
  }
}

// ==================== HELPER FUNCTIONS ====================

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

async function getWhatsAppConfig(supabase: any): Promise<WhatsAppConfig> {
  const provider = (await getSystemConfig(supabase, "whatsapp_provider")) as "evolution" | "uazapi" || "evolution";
  
  if (provider === "uazapi") {
    const subdomain = await getSystemConfig(supabase, "uazapi_subdomain");
    const adminToken = await getSystemConfig(supabase, "uazapi_admin_token");
    
    if (!subdomain || !adminToken) {
      throw new Error("UAZAPI não configurada. Configure o subdomínio e token nas configurações.");
    }
    
    return {
      provider: "uazapi",
      baseUrl: subdomain,
      apiKey: adminToken,
      adminToken,
    };
  } else {
    const apiUrl = await getSystemConfig(supabase, "evolution_api_url");
    const apiKey = await getSystemConfig(supabase, "evolution_api_key");
    
    if (!apiUrl || !apiKey) {
      throw new Error("Evolution API não configurada. Configure a URL e API Key nas configurações.");
    }
    
    return {
      provider: "evolution",
      baseUrl: apiUrl,
      apiKey,
    };
  }
}

// ==================== REQUEST INTERFACE ====================

interface WhatsAppApiRequest {
  action: 
    | "create" 
    | "connect" 
    | "disconnect" 
    | "delete" 
    | "status" 
    | "qrcode" 
    | "fetch-groups" 
    | "test-connection" 
    | "fetch-invite-code"
    | "send-text"
    | "send-media"
    | "send-poll";
  instanceId?: string;
  instanceName?: string;
  onlyAdmin?: boolean;
  groupId?: string;
  whatsappGroupId?: string;
  // For test-connection with custom credentials
  apiUrl?: string;
  apiKey?: string;
  provider?: "evolution" | "uazapi";
  // For sending messages
  text?: string;
  media?: MediaPayload;
  poll?: PollPayload;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth check
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

    const body: WhatsAppApiRequest = await req.json();
    console.log(`WhatsApp API action: ${body.action} by user ${user.id}`);

    // Get WhatsApp config and create adapter
    const config = await getWhatsAppConfig(supabase);
    const adapter = createAdapter(config);
    console.log(`Using provider: ${config.provider}`);

    switch (body.action) {
      case "test-connection": {
        // For custom credentials testing
        if (body.apiUrl && body.apiKey) {
          const testProvider = body.provider || "evolution";
          const testConfig: WhatsAppConfig = {
            provider: testProvider,
            baseUrl: body.apiUrl,
            apiKey: body.apiKey,
            adminToken: body.apiKey,
          };
          const testAdapter = createAdapter(testConfig);
          const result = await testAdapter.testConnection();
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const result = await adapter.testConnection();
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        if (!body.instanceName) {
          throw new Error("Nome da instância é obrigatório");
        }

        const result = await adapter.createInstance(body.instanceName);
        
        if (!result.success) {
          throw new Error(result.error);
        }

        return new Response(JSON.stringify({ success: true, data: result.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect":
      case "qrcode": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        const result = await adapter.connectInstance(instance.instance_name);

        if (result.status === "connected") {
          await supabase
            .from("whatsapp_instances")
            .update({ 
              status: "connected",
              qr_code: null,
              last_connected_at: new Date().toISOString()
            })
            .eq("id", body.instanceId);
        } else if (result.qrcode) {
          await supabase
            .from("whatsapp_instances")
            .update({ 
              qr_code: result.qrcode,
              status: "qr_pending"
            })
            .eq("id", body.instanceId);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          qrcode: result.qrcode,
          status: result.status
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        const result = await adapter.getInstanceStatus(instance.instance_name);

        // If instance not found, try to recreate
        if (!result.success) {
          console.log("Instance not found in API, recreating...");
          const createResult = await adapter.createInstance(instance.instance_name);
          
          if (createResult.success) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "disconnected", qr_code: null, phone_number: null })
              .eq("id", body.instanceId);

            return new Response(JSON.stringify({ 
              success: true, 
              status: "disconnected", 
              recreated: true,
              message: "Instância foi recriada. Conecte novamente."
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Get phone number if connected but not stored
        let phoneNumber = instance.phone_number;
        if (result.status === "connected" && !phoneNumber) {
          phoneNumber = result.phoneNumber || await adapter.getInstancePhoneNumber(instance.instance_name);
        }

        await supabase
          .from("whatsapp_instances")
          .update({ 
            status: result.status,
            phone_number: phoneNumber || instance.phone_number,
            last_connected_at: result.status === "connected" ? new Date().toISOString() : instance.last_connected_at,
            qr_code: result.status === "connected" ? null : instance.qr_code
          })
          .eq("id", body.instanceId);

        return new Response(JSON.stringify({ success: true, status: result.status, raw: result.raw }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        await adapter.logoutInstance(instance.instance_name);
        await adapter.deleteInstance(instance.instance_name);

        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", body.instanceId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        await adapter.deleteInstance(instance.instance_name);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "fetch-groups": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        // Get phone for admin detection
        let instancePhone = instance.phone_number?.replace(/\D/g, "") || "";
        if (!instancePhone) {
          instancePhone = await adapter.getInstancePhoneNumber(instance.instance_name) || "";
          if (instancePhone) {
            await supabase
              .from("whatsapp_instances")
              .update({ phone_number: instancePhone })
              .eq("id", instance.id);
          }
        }

        const groups = await adapter.fetchGroups(instance.instance_name, true);
        console.log(`Fetched ${groups.length} groups`);

        // Process groups (same logic as original)
        const { data: existingGroups } = await supabase
          .from("groups")
          .select("id, whatsapp_id")
          .eq("user_id", user.id);

        const existingGroupsMap = new Map((existingGroups || []).map((g: any) => [g.whatsapp_id, g.id]));
        const groupInstancesToUpsert: any[] = [];
        const groupsToInsert: any[] = [];
        const groupsToUpdate: { id: string; data: any }[] = [];

        for (const group of groups) {
          let isUserAdmin = false;
          if (group.participants && instancePhone) {
            for (const participant of group.participants) {
              const participantPhone = (participant.phoneNumber || participant.id || "")
                .replace("@s.whatsapp.net", "")
                .replace("@lid", "")
                .replace(/\D/g, "");
              
              const phoneLast10 = participantPhone.slice(-10);
              const instancePhoneLast10 = instancePhone.slice(-10);
              const isCurrentUser = participantPhone === instancePhone || phoneLast10 === instancePhoneLast10;
              
              if (isCurrentUser) {
                isUserAdmin = participant.admin === "admin" || participant.admin === "superadmin";
                break;
              }
            }
          }

          if (body.onlyAdmin && !isUserAdmin) continue;

          let inviteCode = group.inviteCode;
          if (!inviteCode && isUserAdmin) {
            inviteCode = await adapter.getInviteCode(instance.instance_name, group.id) || undefined;
          }

          const existingId = existingGroupsMap.get(group.id);
          const groupData = {
            user_id: user.id,
            instance_id: instance.id,
            whatsapp_id: group.id,
            name: group.subject,
            description: group.desc || null,
            invite_link: inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null,
            member_count: group.size || group.participants?.length || 0,
            participants_count: group.participants?.length || 0,
            max_members: 256,
            is_active: existingId ? undefined : false,
            is_user_admin: isUserAdmin,
            synced_at: new Date().toISOString(),
          };

          if (existingId) {
            delete groupData.is_active;
            groupsToUpdate.push({ id: existingId, data: groupData });
            groupInstancesToUpsert.push({ group_id: existingId, instance_id: instance.id, is_admin: isUserAdmin });
          } else {
            groupsToInsert.push({ ...groupData, _isUserAdmin: isUserAdmin });
          }
        }

        // Insert new groups
        if (groupsToInsert.length > 0) {
          const cleanGroups = groupsToInsert.map(g => {
            const { _isUserAdmin, ...clean } = g;
            return clean;
          });
          
          const { data: insertedData } = await supabase
            .from("groups")
            .insert(cleanGroups)
            .select("id, whatsapp_id");

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

        // Update existing groups
        for (const { id, data } of groupsToUpdate) {
          await supabase.from("groups").update(data).eq("id", id);
        }

        // Upsert group_instances
        if (groupInstancesToUpsert.length > 0) {
          await supabase
            .from("group_instances")
            .upsert(
              groupInstancesToUpsert.map(gi => ({ ...gi, synced_at: new Date().toISOString() })),
              { onConflict: "group_id,instance_id" }
            );
        }

        return new Response(JSON.stringify({ 
          success: true, 
          count: groups.length,
          inserted: groupsToInsert.length,
          updated: groupsToUpdate.length,
          message: `${groups.length} grupos sincronizados`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "fetch-invite-code": {
        if (!body.groupId || !body.whatsappGroupId) {
          throw new Error("groupId e whatsappGroupId são obrigatórios");
        }

        const { data: groupData, error: groupError } = await supabase
          .from("groups")
          .select("id, name, instance_id, whatsapp_id")
          .eq("id", body.groupId)
          .eq("user_id", user.id)
          .single();

        if (groupError || !groupData) {
          throw new Error("Grupo não encontrado");
        }

        const { data: instanceData } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", groupData.instance_id)
          .single();

        if (!instanceData) {
          throw new Error("Instância não encontrada");
        }

        const inviteCode = await adapter.getInviteCode(instanceData.instance_name, body.whatsappGroupId);

        if (!inviteCode) {
          throw new Error("Link de convite não disponível. Verifique se você é admin do grupo.");
        }

        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        await supabase
          .from("groups")
          .update({ invite_link: inviteLink })
          .eq("id", body.groupId);

        return new Response(JSON.stringify({ success: true, inviteCode, inviteLink }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-text": {
        if (!body.instanceName || !body.whatsappGroupId || !body.text) {
          throw new Error("instanceName, whatsappGroupId e text são obrigatórios");
        }

        const result = await adapter.sendTextMessage(body.instanceName, body.whatsappGroupId, body.text);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-media": {
        if (!body.instanceName || !body.whatsappGroupId || !body.media) {
          throw new Error("instanceName, whatsappGroupId e media são obrigatórios");
        }

        const result = await adapter.sendMediaMessage(body.instanceName, body.whatsappGroupId, body.media);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "configure-settings": {
        const { data: instance, error } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instanceId)
          .eq("user_id", user.id)
          .single();

        if (error || !instance) {
          throw new Error("Instância não encontrada");
        }

        const result = await adapter.configureInstanceSettings(instance.instance_name);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-poll": {
        if (!body.instanceName || !body.whatsappGroupId || !body.poll) {
          throw new Error("instanceName, whatsappGroupId e poll são obrigatórios");
        }

        const result = await adapter.sendPollMessage(body.instanceName, body.whatsappGroupId, body.poll);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Ação não suportada: ${body.action}`);
    }

  } catch (error) {
    console.error("WhatsApp API error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
