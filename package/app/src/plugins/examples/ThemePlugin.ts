import { ExtendedPlugin } from '../types';

// 示例主题配置
const lightTheme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5',
    },
  },
};

const darkTheme = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
};

const blueTheme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#ff9800',
    },
    background: {
      default: '#e3f2fd',
      paper: '#ffffff',
    },
  },
};

// 主题插件定义
export const ThemePlugin: ExtendedPlugin = {
  id: 'theme-plugin',
  name: 'Theme Management Plugin',
  version: '1.0.0',
  description: 'A plugin for managing application themes',
  author: 'Plugin Developer',
  type: 'theme',
  enabled: true,
  dependencies: [],

  // 主题配置
  themes: [
    {
      name: 'light',
      theme: lightTheme,
      isDark: false,
      customColors: ['#1976d2', '#dc004e']
    },
    {
      name: 'dark',
      theme: darkTheme,
      isDark: true,
      customColors: ['#90caf9', '#f48fb1']
    },
    {
      name: 'blue',
      theme: blueTheme,
      isDark: false,
      customColors: ['#2196f3', '#ff9800']
    }
  ],

  // 生命周期钩子
  onInstall: async (context) => {
    console.log('Theme plugin installed');
    context.utils.showNotification('Theme plugin installed successfully', 'success');
  },

  onUninstall: async (context) => {
    console.log('Theme plugin uninstalled');
    context.utils.showNotification('Theme plugin uninstalled', 'warning');
  },

  onEnable: async (context) => {
    console.log('Theme plugin enabled');
    context.utils.showNotification('Theme plugin enabled', 'success');
  },

  onDisable: async (context) => {
    console.log('Theme plugin disabled');
    context.utils.showNotification('Theme plugin disabled', 'warning');
  }
};