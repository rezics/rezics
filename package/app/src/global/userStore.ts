import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface UserState {
  // 状态
  user: User | null
  isAuthenticated: boolean
  
  // Actions
  setUser: (user: User | null) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  // 初始状态
  user: null,
  isAuthenticated: false,

  // Actions
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user 
  }),
  
  logout: () => set({ 
    user: null, 
    isAuthenticated: false 
  }),
})) 