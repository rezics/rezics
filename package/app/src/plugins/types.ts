import React, { ReactNode } from 'react';
import { RouteProps } from 'wouter';

// 插件基础接口
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  enabled: boolean;
}

// 路由插件接口
export interface RoutePlugin extends Plugin {
  type: 'route';
  routes: RouteConfig[];
}

// 组件插件接口
export interface ComponentPlugin extends Plugin {
  type: 'component';
  components: ComponentConfig[];
}

// 功能插件接口
export interface FeaturePlugin extends Plugin {
  type: 'feature';
  features: FeatureConfig[];
}

// 主题插件接口
export interface ThemePlugin extends Plugin {
  type: 'theme';
  themes: ThemeConfig[];
}

// 路由配置
export interface RouteConfig {
  path: string;
  component: React.ComponentType<any>;
  layout?: React.ComponentType<{ children: ReactNode }>;
  exact?: boolean;
  meta?: {
    title?: string;
    icon?: string;
    requiresAuth?: boolean;
    permissions?: string[];
  };
}

// 组件配置
export interface ComponentConfig {
  name: string;
  component: React.ComponentType<any>;
  category?: string;
  props?: Record<string, any>;
}

// 功能配置
export interface FeatureConfig {
  name: string;
  handler: (...args: any[]) => any;
  category?: string;
  permissions?: string[];
}

// 主题配置
export interface ThemeConfig {
  name: string;
  theme: any;
  isDark?: boolean;
  customColors?: string[];
}

// 插件管理器接口
export interface PluginManager {
  register(plugin: Plugin): void;
  unregister(pluginId: string): void;
  getPlugin(pluginId: string): Plugin | undefined;
  getPluginsByType<T extends Plugin>(type: string): T[];
  enablePlugin(pluginId: string): void;
  disablePlugin(pluginId: string): void;
  getAllPlugins(): Plugin[];
}

// 插件上下文
export interface PluginContext {
  manager: PluginManager;
  app: {
    version: string;
    name: string;
  };
  utils: {
    navigate: (path: string) => void;
    showNotification: (message: string, type?: 'success' | 'error' | 'warning') => void;
  };
}

// 插件生命周期钩子
export interface PluginLifecycle {
  onInstall?: (context: PluginContext) => void | Promise<void>;
  onUninstall?: (context: PluginContext) => void | Promise<void>;
  onEnable?: (context: PluginContext) => void | Promise<void>;
  onDisable?: (context: PluginContext) => void | Promise<void>;
}

// 扩展插件接口，包含生命周期
export interface ExtendedPlugin extends Plugin, PluginLifecycle {
  type: 'route' | 'component' | 'feature' | 'theme';
}