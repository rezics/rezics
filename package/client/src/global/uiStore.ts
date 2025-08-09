import { create } from "zustand";
import { pipe } from "effect/Function";
import * as Array from "effect/Array";

interface UIState {
    // 状态
    sidebarOpen: boolean;
    currentPage: string;
    notifications: ReadonlyArray<string>;

    // Actions
    toggleSidebar: () => void;
    setCurrentPage: (page: string) => void;
    addNotification: (message: string) => void;
    removeNotification: (index: number) => void;
    clearNotifications: () => void;
}

/**
 * 状态管理工具
 */
const stateUtils = {
    /**
     * 安全地添加通知到数组
     */
    addNotification:
        (message: string) =>
        (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
            pipe(notifications, Array.append(message)),

    /**
     * 安全地移除指定索引的通知
     */
    removeNotification:
        (index: number) =>
        (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
            pipe(notifications, (arr) => arr.filter((_, i) => i !== index)),

    /**
     * 清空通知数组
     */
    clearNotifications: (): ReadonlyArray<string> => [],

    /**
     * 切换布尔值状态
     */
    toggle: (value: boolean): boolean => !value,
};

export const uiStore = create<UIState>((set) => ({
    // 初始状态
    sidebarOpen: true,
    currentPage: "home",
    notifications: [],

    // Actions
    toggleSidebar: () =>
        set((state) => ({
            sidebarOpen: stateUtils.toggle(state.sidebarOpen),
        })),

    setCurrentPage: (page) => set((state) => ({ ...state, currentPage: page })),

    addNotification: (message) =>
        set((state) => ({
            notifications: stateUtils.addNotification(message)(
                state.notifications,
            ),
        })),

    removeNotification: (index) =>
        set((state) => ({
            notifications: stateUtils.removeNotification(index)(
                state.notifications,
            ),
        })),

    clearNotifications: () =>
        set(() => ({
            notifications: stateUtils.clearNotifications(),
        })),
}));
