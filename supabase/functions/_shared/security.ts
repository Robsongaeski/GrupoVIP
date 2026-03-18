// ============================================
// SHARED SECURITY UTILITIES FOR EDGE FUNCTIONS
// ============================================

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://www.vipsend.com.br',
  'https://vipsend.com.br',
  'https://grupo-wa.lovable.app',
  'https://id-preview--ed1e3471-5fec-4750-a69b-c67fab8e4c6b.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
];

// Get CORS headers with origin validation
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0];
    
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Legacy CORS headers for backward compatibility (use getCorsHeaders instead)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Input sanitization - removes control characters
export function sanitizeText(input: string | null | undefined): string | null {
  if (!input) return null;
  // Remove control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Validate UUID format
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Validate email format
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Validate URL format (http/https only)
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return true; // Empty is valid
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Validate phone number (basic validation)
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  // Remove non-digits and check length
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// Rate limiting check (simple in-memory, should use Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);
  
  if (!record || record.resetAt < now) {
    requestCounts.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Secure error response (never expose internal errors)
export function secureErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
  statusCode: number = 500
): Response {
  console.error('Edge function error:', error);
  
  // Never expose stack traces or internal errors
  const safeMessage = statusCode === 401 
    ? 'Não autorizado'
    : statusCode === 403
    ? 'Acesso negado'
    : statusCode === 404
    ? 'Recurso não encontrado'
    : statusCode === 429
    ? 'Muitas requisições. Tente novamente mais tarde.'
    : 'Erro interno do servidor';
    
  return new Response(
    JSON.stringify({ error: safeMessage }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Validate webhook signature (for MercadoPago)
export async function validateMercadoPagoSignature(
  signature: string | null,
  requestId: string | null,
  body: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    console.warn('Missing signature or secret for webhook validation');
    return false;
  }
  
  try {
    // Parse signature format: ts=xxx,v1=xxx
    const parts = signature.split(',');
    const signatureParts: Record<string, string> = {};
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        signatureParts[key.trim()] = value.trim();
      }
    }
    
    const ts = signatureParts.ts;
    const v1 = signatureParts.v1;
    
    if (!ts || !v1) {
      console.warn('Invalid signature format');
      return false;
    }
    
    // Check timestamp (prevent replay attacks - 5 minute window)
    const timestamp = parseInt(ts, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.warn('Signature timestamp too old');
      return false;
    }
    
    // Calculate expected signature
    const dataId = requestId || '';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(manifest)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return expectedSignature === v1;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

// Validate and parse JSON safely
export async function safeParseJson<T>(req: Request): Promise<{ data: T | null; error: string | null }> {
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return { data: null, error: 'Empty request body' };
    }
    
    // Check for maximum body size (1MB)
    if (text.length > 1024 * 1024) {
      return { data: null, error: 'Request body too large' };
    }
    
    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: 'Invalid JSON' };
  }
}
