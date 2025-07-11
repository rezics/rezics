import { PluginManager } from './PluginManager';
import { RoutePluginSystem } from './RoutePluginSystem';
import { ComponentPluginSystem } from './ComponentPluginSystem';
import { FeaturePluginSystem } from './FeaturePluginSystem';
import { ThemePluginSystem } from './ThemePluginSystem';
import { PluginContext, ExtendedPlugin } from './types';

export class PluginApp {
  private pluginManager: PluginManager;
  private routeSystem: RoutePluginSystem;
  private componentSystem: ComponentPluginSystem;
  private featureSystem: FeaturePluginSystem;
  private themeSystem: ThemePluginSystem;
  private context: PluginContext;

  constructor(appName: string = 'PluginApp', appVersion: string = '1.0.0') {
    // 创建插件上下文
    this.context = {
      manager: {} as PluginManager, // 临时占位，稍后设置
      app: {
        name: appName,
        version: appVersion
      },
      utils: {
        navigate: (path: string) => {
          // 这里可以集成路由导航
          console.log(`Navigating to: ${path}`);
        },
        showNotification: (message: string, type: 'success' | 'error' | 'warning' = 'warning') => {
          // 这里可以集成通知系统
          console.log(`[${type.toUpperCase()}] ${message}`);
        }
      }
    };

    // 创建插件管理器
    this.pluginManager = new PluginManager(this.context);
    this.context.manager = this.pluginManager;

    // 创建各个插件系统
    this.routeSystem = new RoutePluginSystem(this.pluginManager);
    this.componentSystem = new ComponentPluginSystem(this.pluginManager);
    this.featureSystem = new FeaturePluginSystem(this.pluginManager);
    this.themeSystem = new ThemePluginSystem(this.pluginManager);
  }

  /**
   * 获取插件管理器
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * 获取路由插件系统
   */
  getRouteSystem(): RoutePluginSystem {
    return this.routeSystem;
  }

  /**
   * 获取组件插件系统
   */
  getComponentSystem(): ComponentPluginSystem {
    return this.componentSystem;
  }

  /**
   * 获取功能插件系统
   */
  getFeatureSystem(): FeaturePluginSystem {
    return this.featureSystem;
  }

  /**
   * 获取主题插件系统
   */
  getThemeSystem(): ThemePluginSystem {
    return this.themeSystem;
  }

  /**
   * 获取插件上下文
   */
  getContext(): PluginContext {
    return this.context;
  }

  /**
   * 注册插件
   */
  registerPlugin(plugin: ExtendedPlugin): void {
    this.pluginManager.register(plugin);
  }

  /**
   * 批量注册插件
   */
  registerPlugins(plugins: ExtendedPlugin[]): void {
    plugins.forEach(plugin => this.registerPlugin(plugin));
  }

  /**
   * 初始化应用
   */
  async initialize(): Promise<void> {
    console.log('Initializing PluginApp...');
    
    // 这里可以添加应用初始化逻辑
    // 例如：加载默认插件、设置默认主题等
    
    console.log('PluginApp initialized successfully');
  }

  /**
   * 获取应用状态
   */
  getStatus(): {
    totalPlugins: number;
    enabledPlugins: number;
    routeCount: number;
    componentCount: number;
    featureCount: number;
    themeCount: number;
  } {
    const allPlugins = this.pluginManager.getAllPlugins();
    const enabledPlugins = this.pluginManager.getEnabledPlugins();

    return {
      totalPlugins: allPlugins.length,
      enabledPlugins: enabledPlugins.length,
      routeCount: this.routeSystem.getEnabledRoutes().length,
      componentCount: this.componentSystem.getEnabledComponents().length,
      featureCount: this.featureSystem.getEnabledFeatures().length,
      themeCount: this.themeSystem.getEnabledThemes().length
    };
  }

  /**
   * 获取插件统计信息
   */
  getPluginStats(): {
    byType: Record<string, number>;
    byStatus: { enabled: number; disabled: number };
  } {
    const allPlugins = this.pluginManager.getAllPlugins();
    const enabledPlugins = this.pluginManager.getEnabledPlugins();

    const byType: Record<string, number> = {};
    allPlugins.forEach(plugin => {
      byType[plugin.type] = (byType[plugin.type] || 0) + 1;
    });

    return {
      byType,
      byStatus: {
        enabled: enabledPlugins.length,
        disabled: allPlugins.length - enabledPlugins.length
      }
    };
  }

  /**
   * 清理应用
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up PluginApp...');
    
    // 这里可以添加清理逻辑
    // 例如：保存插件状态、清理资源等
    
    console.log('PluginApp cleaned up successfully');
  }
}