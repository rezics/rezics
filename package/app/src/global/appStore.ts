import { create } from "zustand";

interface AppState {
    // 应用状态
    isLoading: boolean;
    theme: "light" | "dark";

    // Actions
    setLoading: (loading: boolean) => void;
    setTheme: (theme: "light" | "dark") => void;
}

export const appStore = create<AppState>((set) => ({
    // 初始状态
    isLoading: false,
    theme: "light",

    // Actions
    setLoading: (loading) => set({ isLoading: loading }),
    setTheme: (theme) => set({ theme }),
}));
