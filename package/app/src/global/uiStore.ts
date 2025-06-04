import { create } from 'zustand'

interface UIState {
  // 状态
  sidebarOpen: boolean
  currentPage: string
  notifications: string[]
  
  // Actions
  toggleSidebar: () => void
  setCurrentPage: (page: string) => void
  addNotification: (message: string) => void
  clearNotifications: () => void
}

export const uiStore = create<UIState>((set) => ({
  // 初始状态
  sidebarOpen: true,
  currentPage: 'home',
  notifications: [],

  // Actions
  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  addNotification: (message) => set((state) => ({
    notifications: [...state.notifications, message]
  })),
  
  clearNotifications: () => set({ notifications: [] }),
})) 