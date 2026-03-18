import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Eye, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ImpersonationBanner() {
  const { impersonatedUser, isImpersonating, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !impersonatedUser) return null;

  const handleStop = () => {
    stopImpersonation();
    navigate("/admin/clients");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Visualizando como: <strong>{impersonatedUser.fullName || impersonatedUser.email}</strong>
        {impersonatedUser.fullName && (
          <span className="opacity-75 ml-1">({impersonatedUser.email})</span>
        )}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-2 bg-amber-600/20 border-amber-700/30 text-amber-950 hover:bg-amber-600/40 h-7 text-xs"
        onClick={handleStop}
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Voltar ao Admin
      </Button>
    </div>
  );
}
