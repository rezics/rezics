import { create } from "zustand";

/** Data structure persisted per route. 每个路由要保存的数据结构 */
interface RouteData {
  scrollY?: number;
  tab?: string;
}

/** State and actions for the whole store. 整个 store 的状态和操作 */
interface RouteStore {
  /** Route key -> RouteData. 路由 key -> RouteData */
  routeMap: Record<string, RouteData>;
  /** Set or merge data for a given route. 设置或合并某个路由的数据 */
  setRouteData: (routeKey: string, data: Partial<RouteData>) => void;
  /** Clear data for a given route (optional). 清空某个路由的数据（可选） */
  clearRouteData: (routeKey: string) => void;
  /** Get data for a given route. 获取某个路由的数据 */
  getRouteData: (routeKey: string) => RouteData | undefined;
}

export const useRouteStore = create<RouteStore>((set, get) => ({
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
