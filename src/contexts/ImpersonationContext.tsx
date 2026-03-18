import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";

interface ImpersonatedUser {
  id: string;
  email: string;
  fullName: string | null;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  isImpersonating: boolean;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  /** Returns the impersonated user ID if active, otherwise the real user ID */
  effectiveUserId: string | undefined;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = "vipsend_impersonation";

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Clear impersonation if the admin logs out
  useEffect(() => {
    if (!user) {
      setImpersonatedUser(null);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const startImpersonation = useCallback((targetUser: ImpersonatedUser) => {
    setImpersonatedUser(targetUser);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(targetUser));
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const isImpersonating = !!impersonatedUser;
  const effectiveUserId = impersonatedUser?.id || user?.id;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
        effectiveUserId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
