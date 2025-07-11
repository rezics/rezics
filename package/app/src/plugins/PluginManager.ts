import { Plugin, PluginManager as IPluginManager, PluginContext, ExtendedPlugin } from './types';

export class PluginManager implements IPluginManager {
  private plugins: Map<string, ExtendedPlugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * 注册插件
   */
  register(plugin: ExtendedPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered`);
      return;
    }

    // 检查依赖
    if (plugin.dependencies) {
      const missingDeps = plugin.dependencies.filter(dep => !this.plugins.has(dep));
      if (missingDeps.length > 0) {
        throw new Error(`Plugin ${plugin.id} has missing dependencies: ${missingDeps.join(', ')}`);
      }
    }

    this.plugins.set(plugin.id, plugin);
    
    // 如果插件默认启用，执行启用逻辑
    if (plugin.enabled) {
      this.enablePlugin(plugin.id);
    }

    console.log(`Plugin ${plugin.id} registered successfully`);
  }

  /**
   * 注销插件
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`Plugin ${pluginId} not found`);
      return;
    }

    // 检查是否有其他插件依赖此插件
    const dependentPlugins = Array.from(this.plugins.values())
      .filter(p => p.dependencies?.includes(pluginId));
    
    if (dependentPlugins.length > 0) {
      throw new Error(`Cannot unregister plugin ${pluginId}: it is required by ${dependentPlugins.map(p => p.id).join(', ')}`);
    }

    // 执行卸载逻辑
    if (plugin.onUninstall) {
      plugin.onUninstall(this.context);
    }

    this.plugins.delete(pluginId);
    console.log(`Plugin ${pluginId} unregistered successfully`);
  }

  /**
   * 获取插件
   */
  getPlugin(pluginId: string): ExtendedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 根据类型获取插件
   */
  getPluginsByType<T extends Plugin>(type: string): T[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.type === type && plugin.enabled) as unknown as T[];
  }

  /**
   * 启用插件
   */
  enablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`Plugin ${pluginId} not found`);
      return;
    }

    if (plugin.enabled) {
      console.warn(`Plugin ${pluginId} is already enabled`);
      return;
    }

    // 检查依赖是否都已启用
    if (plugin.dependencies) {
      const disabledDeps = plugin.dependencies.filter(dep => {
        const depPlugin = this.plugins.get(dep);
        return !depPlugin || !depPlugin.enabled;
      });
      
      if (disabledDeps.length > 0) {
        throw new Error(`Cannot enable plugin ${pluginId}: dependencies not enabled: ${disabledDeps.join(', ')}`);
      }
    }

    plugin.enabled = true;

    // 执行启用逻辑
    if (plugin.onEnable) {
      plugin.onEnable(this.context);
    }

    console.log(`Plugin ${pluginId} enabled successfully`);
  }

  /**
   * 禁用插件
   */
  disablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`Plugin ${pluginId} not found`);
      return;
    }

    if (!plugin.enabled) {
      console.warn(`Plugin ${pluginId} is already disabled`);
      return;
    }

    // 检查是否有启用的插件依赖此插件
    const dependentPlugins = Array.from(this.plugins.values())
      .filter(p => p.enabled && p.dependencies?.includes(pluginId));
    
    if (dependentPlugins.length > 0) {
      throw new Error(`Cannot disable plugin ${pluginId}: it is required by enabled plugins: ${dependentPlugins.map(p => p.id).join(', ')}`);
    }

    plugin.enabled = false;

    // 执行禁用逻辑
    if (plugin.onDisable) {
      plugin.onDisable(this.context);
    }

    console.log(`Plugin ${pluginId} disabled successfully`);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): ExtendedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): ExtendedPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.enabled);
  }

  /**
   * 批量启用插件
   */
  enablePlugins(pluginIds: string[]): void {
    pluginIds.forEach(id => {
      try {
        this.enablePlugin(id);
      } catch (error) {
        console.error(`Failed to enable plugin ${id}:`, error);
      }
    });
  }

  /**
   * 批量禁用插件
   */
  disablePlugins(pluginIds: string[]): void {
    pluginIds.forEach(id => {
      try {
        this.disablePlugin(id);
      } catch (error) {
        console.error(`Failed to disable plugin ${id}:`, error);
      }
    });
  }

  /**
   * 获取插件状态
   */
  getPluginStatus(pluginId: string): { enabled: boolean; dependencies: string[]; dependents: string[] } | null {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;

    const dependents = Array.from(this.plugins.values())
      .filter(p => p.dependencies?.includes(pluginId))
      .map(p => p.id);

    return {
      enabled: plugin.enabled,
      dependencies: plugin.dependencies || [],
      dependents
    };
  }
}