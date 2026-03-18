import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface RedirectData {
  success: boolean;
  redirectUrl: string;
  originalUrl: string;
  pixelId: string | null;
  pixelEvent: string;
  landingPage: {
    title: string | null;
    description: string | null;
    logoUrl: string | null;
  } | null;
  error?: string;
}

// Detect social media in-app browsers (Instagram, Facebook, etc.)
function isSocialInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // FB_IAB = Facebook In-App Browser, FBAV = Facebook App Version, 
  // FBAN = Facebook App Name, Instagram, IABMV = In-App Browser Mobile Version
  return /FB_IAB|FBAV|FBAN|Instagram|IABMV/i.test(ua);
}

// Helper to fire Facebook Pixel event
function firePixelEvent(pixelId: string, event: string) {
  if (typeof window === "undefined") return;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  
  // Load Facebook Pixel SDK
  if (!w.fbq) {
    (function(f: any, b: Document, e: string, v: string) {
      let n: any;
      const t = b.createElement(e) as HTMLScriptElement;
      const s = b.getElementsByTagName(e)[0];
      if (f.fbq) return;
      n = f.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t.async = true;
      t.src = v;
      s.parentNode?.insertBefore(t, s);
    })(w, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  }
  
  w.fbq("init", pixelId);
  w.fbq("track", event);
  
  // Also add noscript pixel image for tracking
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=${event}&noscript=1`;
  document.body.appendChild(img);
}

// Escape page component for in-app browsers
function InAppBrowserEscapePage({ 
  redirectUrl, 
  title,
  pixelId,
  pixelEvent 
}: { 
  redirectUrl: string; 
  title: string;
  pixelId: string | null;
  pixelEvent: string;
}) {
  // Fire pixel on mount
  useEffect(() => {
    if (pixelId) {
      firePixelEvent(pixelId, pixelEvent);
    }
  }, [pixelId, pixelEvent]);

  return (
    <div 
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "360px" }}>
        {/* WhatsApp Icon */}
        <div style={{ marginBottom: "24px" }}>
          <svg 
            width="80" 
            height="80" 
            viewBox="0 0 24 24" 
            fill="white"
            style={{ margin: "0 auto" }}
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>

        <h1 style={{ 
          color: "white", 
          fontSize: "24px", 
          fontWeight: "bold",
          marginBottom: "16px"
        }}>
          {title || "Entrar no Grupo"}
        </h1>

        <p style={{ 
          color: "rgba(255,255,255,0.9)", 
          fontSize: "16px",
          marginBottom: "32px",
          lineHeight: "1.5"
        }}>
          Toque no botão abaixo para entrar no grupo do WhatsApp
        </p>

        {/* Main CTA Button */}
        <a
          href={redirectUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            backgroundColor: "white",
            color: "#128C7E",
            fontSize: "18px",
            fontWeight: "bold",
            padding: "16px 48px",
            borderRadius: "50px",
            textDecoration: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
        >
          <span style={{ fontSize: "20px" }}>✓</span>
          Abrir WhatsApp
        </a>

        <p style={{ 
          color: "rgba(255,255,255,0.7)", 
          fontSize: "12px",
          marginTop: "24px"
        }}>
          Você será redirecionado para o WhatsApp
        </p>
      </div>
    </div>
  );
}

export default function GoRedirect() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [redirectData, setRedirectData] = useState<RedirectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInAppBrowser] = useState(() => isSocialInAppBrowser());

  useEffect(() => {
    if (!slug) {
      setError("Link inválido");
      setLoading(false);
      return;
    }

    const fetchRedirectData = async () => {
      try {
        // Build URL with UTM parameters preserved
        const supabaseProjectId = "kwqjgflpphuvmduxukau";
        const params = new URLSearchParams();
        params.set("slug", slug);
        params.set("format", "json"); // Request JSON format
        
        // Preserve UTM parameters
        const utmParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
        utmParams.forEach(param => {
          const value = searchParams.get(param);
          if (value) params.set(param, value);
        });

        const edgeFunctionUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/smart-redirect?${params.toString()}`;
        
        const response = await fetch(edgeFunctionUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          setError(errorText || "Link não encontrado ou inativo");
          setLoading(false);
          return;
        }
        
        const data: RedirectData = await response.json();
        
        if (!data.success || !data.redirectUrl) {
          setError(data.error || "Erro ao processar link");
          setLoading(false);
          return;
        }

        setRedirectData(data);
        setLoading(false);

        // For in-app browsers, don't auto-redirect - show escape page
        if (isInAppBrowser) {
          // Fire pixel immediately
          if (data.pixelId) {
            firePixelEvent(data.pixelId, data.pixelEvent || "PageView");
          }
          return;
        }

        // For normal browsers, fire pixel and redirect
        if (data.pixelId) {
          firePixelEvent(data.pixelId, data.pixelEvent || "PageView");
        }

        // Check if we should show landing page
        const hasLandingPage = data.landingPage && 
          (data.landingPage.title || data.landingPage.description);

        if (!hasLandingPage) {
          // Redirect immediately - small delay to ensure pixel fires
          setTimeout(() => {
            window.location.replace(data.redirectUrl);
          }, data.pixelId ? 100 : 0);
        }
      } catch (err) {
        console.error("Error fetching redirect:", err);
        setError("Erro ao processar link");
        setLoading(false);
      }
    };

    fetchRedirectData();
  }, [slug, searchParams, isInAppBrowser]);

  // Auto-redirect after showing landing page (only for normal browsers)
  useEffect(() => {
    if (redirectData && redirectData.redirectUrl && !isInAppBrowser) {
      const hasLandingPage = redirectData.landingPage && 
        (redirectData.landingPage.title || redirectData.landingPage.description);
      
      if (hasLandingPage) {
        const timer = setTimeout(() => {
          window.location.replace(redirectData.redirectUrl);
        }, 1000); // 1 second delay to show landing page
        return () => clearTimeout(timer);
      }
    }
  }, [redirectData, isInAppBrowser]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Erro</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:underline"
          >
            Voltar para o início
          </button>
        </div>
      </div>
    );
  }

  // Show escape page for in-app browsers (Instagram, Facebook, etc.)
  if (isInAppBrowser && redirectData && !loading) {
    return (
      <InAppBrowserEscapePage
        redirectUrl={redirectData.redirectUrl}
        title={redirectData.landingPage?.title || "Entrar no Grupo"}
        pixelId={redirectData.pixelId}
        pixelEvent={redirectData.pixelEvent || "PageView"}
      />
    );
  }

  // Show landing page if configured (normal browsers)
  if (redirectData?.landingPage && !loading && !isInAppBrowser) {
    const { landingPage, redirectUrl } = redirectData;
    const hasLandingPage = landingPage.title || landingPage.description;
    
    if (hasLandingPage) {
      return (
        <div 
          className="min-h-screen flex flex-col items-center justify-center p-5"
          style={{
            background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
            color: "white",
            textAlign: "center",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div className="max-w-md">
            {landingPage.logoUrl && (
              <img 
                src={landingPage.logoUrl} 
                alt="Logo" 
                className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold mb-2">
              {landingPage.title || "Entrando no grupo..."}
            </h1>
            {landingPage.description && (
              <p className="opacity-90 mb-4">{landingPage.description}</p>
            )}
            <div 
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"
            />
            <a 
              href={redirectUrl}
              className="text-white/80 text-sm underline hover:text-white"
            >
              Toque aqui se não for redirecionado
            </a>
          </div>
        </div>
      );
    }
  }

  // Minimal loading state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
