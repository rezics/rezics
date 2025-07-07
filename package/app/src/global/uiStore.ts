import { create } from 'zustand';
import { pipe } from '@/util/fp';
import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import { objectUtils } from '@/util/fp';

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
 * 函数式状态管理工具
 * 
 * 重构改进：
 * - 使用 ReadonlyArray 确保不可变性
 * - 提供更多实用的状态操作方法
 * - 使用 fp-ts 进行安全的数组操作
 */
const stateUtils = {
  /**
   * 安全地添加通知到数组
   */
  addNotification: (message: string) => (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(notifications, A.append(message)),
  
  /**
   * 安全地移除指定索引的通知
   */
  removeNotification: (index: number) => (notifications: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(
      notifications,
      A.filterWithIndex((i, _) => i !== index)
    ),
  
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
  currentPage: 'home',
  notifications: [],

  // Actions - 使用函数式方法
  toggleSidebar: () => set((state) => ({
    sidebarOpen: stateUtils.toggle(state.sidebarOpen)
  })),
  
  setCurrentPage: (page) => set(
    objectUtils.updateProp('currentPage', page)
  ),
  
  addNotification: (message) => set((state) => ({
    notifications: stateUtils.addNotification(message)(state.notifications)
  })),
  
  removeNotification: (index) => set((state) => ({
    notifications: stateUtils.removeNotification(index)(state.notifications)
  })),
  
  clearNotifications: () => set((state) => ({
    notifications: stateUtils.clearNotifications()
  })),
})); 