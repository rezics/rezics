import {create} from 'zustand';

interface AppState {
  isLoading: boolean;
  theme: 'light' | 'dark';
  customColor?: string;
  useDynamicTheme: boolean;

  setLoading: (loading: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setCustomColor: (color?: string) => void;
  setUseDynamicTheme: (use: boolean) => void;
}

export const useAppStore = create<AppState>(set => ({
  isLoading: false,
  theme: 'light',
  customColor: undefined,
  useDynamicTheme: false,

  setLoading: loading => set({isLoading: loading}),
  setTheme: theme => set({theme}),
  setCustomColor: color => set({customColor: color}),
  setUseDynamicTheme: use => set({useDynamicTheme: use}),
}));
