import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OrphanedLink {
  link_id: string;
  link_name: string;
  link_slug: string;
  missing_groups: number;
  recoverable_groups: number;
}

interface OrphanedLinksAlertProps {
  onRecoverClick: (linkId: string, linkName: string) => void;
  onRecoverAll: () => void;
  refreshTrigger?: number;
}

export function OrphanedLinksAlert({ 
  onRecoverClick, 
  onRecoverAll,
  refreshTrigger 
}: OrphanedLinksAlertProps) {
  const { user } = useAuth();
  const [orphanedLinks, setOrphanedLinks] = useState<OrphanedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    // Check localStorage for dismissed state
    return localStorage.getItem("orphaned-links-dismissed") === "true";
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("orphaned-links-dismissed", "true");
  };

  const fetchOrphanedLinks = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_orphaned_links', {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching orphaned links:", error);
        return;
      }

      // Filter to only show links with recoverable groups
      const recoverableLinks = (data || []).filter(
        (link: OrphanedLink) => link.recoverable_groups > 0
      );
      
      setOrphanedLinks(recoverableLinks);
    } catch (error) {
      console.error("Error in fetchOrphanedLinks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrphanedLinks();
  }, [user, refreshTrigger]);

  if (loading || orphanedLinks.length === 0 || dismissed) {
    return null;
  }

  const totalRecoverable = orphanedLinks.reduce(
    (sum, link) => sum + link.recoverable_groups, 
    0
  );

  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-500/20"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <AlertTitle className="text-amber-700 dark:text-amber-400 font-semibold pr-8">
        {orphanedLinks.length === 1 
          ? "1 link precisa de atenção"
          : `${orphanedLinks.length} links precisam de atenção`
        }
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-muted-foreground mb-3">
          {totalRecoverable === 1 
            ? "1 grupo foi desconectado e pode ser recuperado automaticamente."
            : `${totalRecoverable} grupos foram desconectados e podem ser recuperados automaticamente.`
          }
        </p>
        
        {orphanedLinks.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mb-2 p-0 h-auto text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar detalhes
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver detalhes ({orphanedLinks.length} links)
              </>
            )}
          </Button>
        )}

        {(expanded || orphanedLinks.length === 1) && (
          <div className="space-y-2 mb-3">
            {orphanedLinks.map((link) => (
              <div 
                key={link.link_id}
                className="flex items-center justify-between p-2 rounded-md bg-background/50"
              >
                <div>
                  <span className="font-medium">{link.link_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    /{link.link_slug}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    ({link.recoverable_groups} grupo{link.recoverable_groups !== 1 ? 's' : ''} recuperável{link.recoverable_groups !== 1 ? 'is' : ''})
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRecoverClick(link.link_id, link.link_name)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Recuperar
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onRecoverAll}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recuperar Todos os Grupos
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
