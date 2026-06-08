// An Example of React Query
// React Query 的一个示例

import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./http";

// 1) key factory (eases hierarchical invalidation / selective matching).
// 1) key 工厂（便于层级失效/选择性匹配）
export const userKeys = {
  all: () => ["users"] as const,
  byId: (id: string) => [...userKeys.all(), "by-id", id] as const,
};

// 2) Raw return type (server contract).
// 2) 原始返回类型（服务端契约）
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// 3) Final type the UI layer needs (TData).
// 3) 最终 UI 层需要的类型（TData）
export interface UserView {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

// 4) Type-safe QueryOptions factory.
// 4) 类型安全的 QueryOptions 工厂
export const userQueries = {
  // Specify <TQueryFnData, TError, TData, TKey> explicitly via generics.
  // 通过泛型显式指定 <TQueryFnData, TError, TData, TKey>
  byId: (id: string) =>
    queryOptions<UserDTO, Error, UserView, ReturnType<typeof userKeys.byId>>({
      queryKey: userKeys.byId(id),
      queryFn: () => apiFetch<UserDTO>(`/user/${id}`),
      // The return value of select (UserView) is the *final* data type.
      // select 的返回值（UserView）就是 *最终* data 类型
      select: (u) => ({
        id: u.id,
        displayName: u.name,
        avatarUrl: u.avatar,
      }),
    }),
};
