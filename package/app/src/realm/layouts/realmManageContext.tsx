import type { RealmDTO } from "@rezics/contract";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { RealmDetailRouteLocation } from "../models/realmDetailRoutes";

export type RealmManageContextValue = {
  realmId: string;
  routeLocation: RealmDetailRouteLocation;
  realm: RealmDTO;
  memberRoleKey?: string;
  canDeleteRealm: boolean;
};

const RealmManageContext = createContext<RealmManageContextValue | null>(null);

export function RealmManageProvider({
  value,
  children,
}: {
  value: RealmManageContextValue;
  children: ReactNode;
}) {
  return (
    <RealmManageContext.Provider value={value}>
      {children}
    </RealmManageContext.Provider>
  );
}

export function useRealmManage(): RealmManageContextValue {
  const context = useContext(RealmManageContext);
  if (!context) {
    throw new Error("useRealmManage must be used within RealmManageProvider");
  }
  return context;
}
