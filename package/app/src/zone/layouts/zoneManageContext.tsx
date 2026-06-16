import type { ZoneDTO, ZonePage } from "@rezics/contract";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { ReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import type { ZoneRouteLocation } from "../models/zoneDetailRoutes";
import type { ZoneRefUnitMap } from "../models/zoneMenu";

export type ZoneManageContextValue = {
  routeLocation: ZoneRouteLocation;
  zone: ZoneDTO;
  refUnits: ZoneRefUnitMap;
  readQuery: Pick<ReadLanguageContext, "languages" | "appLocale">;
  homePageId: string;
  homePageConfig: ZonePage;
};

const ZoneManageContext = createContext<ZoneManageContextValue | null>(null);

export function ZoneManageProvider({
  value,
  children,
}: {
  value: ZoneManageContextValue;
  children: ReactNode;
}) {
  return (
    <ZoneManageContext.Provider value={value}>
      {children}
    </ZoneManageContext.Provider>
  );
}

export function useZoneManage(): ZoneManageContextValue {
  const context = useContext(ZoneManageContext);
  if (!context) {
    throw new Error("useZoneManage must be used within ZoneManageProvider");
  }
  return context;
}
