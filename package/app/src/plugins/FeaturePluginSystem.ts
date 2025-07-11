import { FeaturePlugin, FeatureConfig, PluginManager } from './types';

export class FeaturePluginSystem {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  /**
   * 获取所有启用的功能配置
   */
  getEnabledFeatures(): FeatureConfig[] {
    const featurePlugins = this.pluginManager.getPluginsByType<FeaturePlugin>('feature');
    return featurePlugins.flatMap(plugin => plugin.features);
  }

  /**
   * 根据名称获取功能
   */
  getFeatureByName(name: string): FeatureConfig | undefined {
    const features = this.getEnabledFeatures();
    return features.find(feature => feature.name === name);
  }

  /**
   * 根据分类获取功能
   */
  getFeaturesByCategory(category: string): FeatureConfig[] {
    const features = this.getEnabledFeatures();
    return features.filter(feature => feature.category === category);
  }

  /**
   * 获取所有功能分类
   */
  getAllCategories(): string[] {
    const features = this.getEnabledFeatures();
    const categories = features.map(feature => feature.category).filter((category): category is string => Boolean(category));
    return [...new Set(categories)];
  }

  /**
   * 检查功能是否存在
   */
  hasFeature(name: string): boolean {
    return this.getFeatureByName(name) !== undefined;
  }

  /**
   * 执行功能
   */
  executeFeature(name: string, ...args: any[]): any {
    const feature = this.getFeatureByName(name);
    if (!feature) {
      console.warn(`Feature ${name} not found`);
      return null;
    }

    try {
      return feature.handler(...args);
    } catch (error) {
      console.error(`Error executing feature ${name}:`, error);
      throw error;
    }
  }

  /**
   * 异步执行功能
   */
  async executeFeatureAsync(name: string, ...args: any[]): Promise<any> {
    const feature = this.getFeatureByName(name);
    if (!feature) {
      console.warn(`Feature ${name} not found`);
      return null;
    }

    try {
      const result = feature.handler(...args);
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } catch (error) {
      console.error(`Error executing feature ${name}:`, error);
      throw error;
    }
  }

  /**
   * 获取功能权限要求
   */
  getFeaturePermissions(name: string): string[] {
    const feature = this.getFeatureByName(name);
    return feature?.permissions || [];
  }

  /**
   * 检查用户是否有权限执行功能
   */
  canExecuteFeature(name: string, userPermissions: string[]): boolean {
    const requiredPermissions = this.getFeaturePermissions(name);
    if (requiredPermissions.length === 0) {
      return true; // 没有权限要求
    }

    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * 批量执行功能
   */
  executeFeatures(names: string[], ...args: any[]): any[] {
    return names.map(name => this.executeFeature(name, ...args));
  }

  /**
   * 批量异步执行功能
   */
  async executeFeaturesAsync(names: string[], ...args: any[]): Promise<any[]> {
    const promises = names.map(name => this.executeFeatureAsync(name, ...args));
    return Promise.all(promises);
  }
}