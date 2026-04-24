import { createContext, useState, useEffect, ReactNode, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthContext } from "./use-auth";
import { setActiveAppId, getActiveAppId } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Application } from "@shared/schema";

export interface AppContextType {
  activeAppId: number | null;
  activeApp: Application | null;
  setApp: (id: number | null) => void;
  needsAppSelection: boolean;
  applications: Application[];
}

export const AppContext = createContext<AppContextType>({
  activeAppId: null,
  activeApp: null,
  setApp: () => {},
  needsAppSelection: false,
  applications: [],
});

export function AppContextProvider({ children }: { children: ReactNode }) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;
  const isSuperOrRoot = user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN";

  const [activeAppId, setActiveAppIdState] = useState<number | null>(() => {
    const stored = getActiveAppId();
    return stored ? parseInt(stored) : null;
  });

  useEffect(() => {
    if (user && !isSuperOrRoot && user.applicationId) {
      setActiveAppIdState(user.applicationId);
      setActiveAppId(user.applicationId);
    }
  }, [user]);

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    enabled: isSuperOrRoot,
  });

  const activeApp = applications.find(a => a.id === activeAppId) ?? null;

  const setApp = (id: number | null) => {
    setActiveAppIdState(id);
    setActiveAppId(id);
    queryClient.invalidateQueries();
  };

  // Super/Root can operate without selecting a specific app (will show all apps)
  const needsAppSelection = false;

  return (
    <AppContext.Provider value={{ activeAppId, activeApp, setApp, needsAppSelection, applications }}>
      {children}
    </AppContext.Provider>
  );
}
