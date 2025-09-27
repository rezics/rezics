import { create } from "zustand";

interface AppState {
  // 应用状态
  isLoading: boolean;
  theme: "light" | "dark";
  customColor?: string; // 自定义主题颜色
  useDynamicTheme: boolean; // 是否使用动态主题

  // Actions
  setLoading: (loading: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
  setCustomColor: (color?: string) => void;
  setUseDynamicTheme: (use: boolean) => void;
}

export const appStore = create<AppState>((set) => ({
  // 初始状态
  isLoading: false,
  theme: "light",
  customColor: undefined,
  useDynamicTheme: false,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  setTheme: (theme) => set({ theme }),
  setCustomColor: (color) => set({ customColor: color }),
  setUseDynamicTheme: (use) => set({ useDynamicTheme: use }),
}));
