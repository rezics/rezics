import * as EffectArray from "effect/Array";
import { pipe } from "effect/Function";
import { create } from "zustand";

interface UIState {
  // State.
  // 状态。
  sidebarOpen: boolean;
  currentPage: string;
  notifications: ReadonlyArray<string>;

  // Actions.
  // 操作。
  toggleSidebar: () => void;
  setCurrentPage: (page: string) => void;
  addNotification: (message: string) => void;
  removeNotification: (index: number) => void;
  clearNotifications: () => void;
}

/**
 * State management utilities.
 * 状态管理工具。
 */
const stateUtils = {
  /**
   * Safely append a notification to the array.
   * 安全地将通知追加到数组。
   */
  addNotification:
    (message: string) =>
    (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
      pipe(notifications, EffectArray.append(message)),

  /**
   * Safely remove the notification at the given index.
   * 安全地移除指定索引的通知。
   */
  removeNotification:
    (index: number) =>
    (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
      pipe(notifications, (arr) => arr.filter((_, i) => i !== index)),

  /**
   * Clear the notifications array.
   * 清空通知数组。
   */
  clearNotifications: (): ReadonlyArray<string> => [],

  /**
   * Toggle a boolean value.
   * 切换布尔值。
   */
  toggle: (value: boolean): boolean => !value,
};

export const useUiStore = create<UIState>((set) => ({
  // Initial state.
  // 初始状态。
  sidebarOpen: true,
  currentPage: "home",
  notifications: [],

  // Actions.
  // 操作。
  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: stateUtils.toggle(state.sidebarOpen),
    })),

  setCurrentPage: (page) => set((state) => ({ ...state, currentPage: page })),

  addNotification: (message) =>
    set((state) => ({
      notifications: stateUtils.addNotification(message)(state.notifications),
    })),

  removeNotification: (index) =>
    set((state) => ({
      notifications: stateUtils.removeNotification(index)(state.notifications),
    })),

  clearNotifications: () =>
    set(() => ({
      notifications: stateUtils.clearNotifications(),
    })),
}));
