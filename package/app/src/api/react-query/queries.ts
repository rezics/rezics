// An Example of React Query

import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from './http';

// 1) key 工厂（便于层级失效/选择性匹配）
export const userKeys = {
  all: () => ['users'] as const,
  byId: (id: string) => [...userKeys.all(), 'by-id', id] as const,
};

// 2) 原始返回类型（服务端契约）
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// 3) 最终 UI 层需要的类型（TData）
export interface UserView {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

// 4) 类型安全的 QueryOptions 工厂
export const userQueries = {
  // 通过泛型显式指定 <TQueryFnData, TError, TData, TKey>
  byId: (id: string) =>
    queryOptions<UserDTO, Error, UserView, ReturnType<typeof userKeys.byId>>({
      queryKey: userKeys.byId(id),
      queryFn: () => apiFetch<UserDTO>(`/users/${id}`),
      // select 的返回值（UserView）就是 *最终* data 类型
      select: u => ({
        id: u.id,
        displayName: u.name,
        avatarUrl: u.avatar,
      }),
    }),
};
