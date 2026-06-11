import type {
  RealmDTO,
  RealmMembershipMeDTO,
  TagTreeNode,
} from "@rezics/contract";
import { createContext, useContext } from "react";
import type { RealmDetailRouteLocation } from "../models/realmDetailRoutes";

// Shared realm-detail state for the tabbed detail shell and its tab routes.
// The layout fetches the realm once and derives the permission/visibility
// flags; tab routes read them here instead of re-deriving `showManage` and
// re-fetching the realm in every tab.
// 标签式详情壳层与各标签路由共享的 realm 详情状态。
// 布局只获取一次 realm 并派生权限/可见性标记；各标签路由从此处读取，
// 而非在每个标签里重新推导 showManage 与重新拉取 realm。
export interface RealmDetailContextValue {
  realmId: string;
  routeLocation: RealmDetailRouteLocation;
  realm: RealmDTO;
  membership: RealmMembershipMeDTO | null | undefined;
  isMember: boolean;
  showManage: boolean;
  tagTree: TagTreeNode[] | undefined;
  description: string;
}

const RealmDetailContext = createContext<RealmDetailContextValue | null>(null);

export const RealmDetailProvider = RealmDetailContext.Provider;

export function useRealmDetail(): RealmDetailContextValue {
  const value = useContext(RealmDetailContext);
  if (!value) {
    throw new Error("useRealmDetail must be used within RealmDetailLayout");
  }
  return value;
}
