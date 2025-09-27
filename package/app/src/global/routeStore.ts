// src/store/scrollTabStore.ts
import { create } from "zustand";

/** 每个路由要保存的数据结构 */
interface RouteData {
  scrollY?: number;
  tab?: string;
}

/** 整个 store 的状态和操作 */
interface RouteStore {
  /** 路由 key -> RouteData */
  routeMap: Record<string, RouteData>;
  /** 设置或合并某个路由的数据 */
  setRouteData: (routeKey: string, data: Partial<RouteData>) => void;
  /** 清空某个路由的数据（可选） */
  clearRouteData: (routeKey: string) => void;
  /** 获取某个路由的数据 */
  getRouteData: (routeKey: string) => RouteData | undefined;
}

export const routeStore = create<RouteStore>((set, get) => ({
  routeMap: {},

  setRouteData: (routeKey, data) =>
    set((state) => ({
      routeMap: {
        ...state.routeMap,
        [routeKey]: {
          ...state.routeMap[routeKey],
          ...data,
        },
      },
    })),

  clearRouteData: (routeKey) =>
    set((state) => {
      const { [routeKey]: _, ...rest } = state.routeMap;
      return { routeMap: rest };
    }),

  getRouteData: (routeKey) => {
    return get().routeMap[routeKey];
  },
}));
