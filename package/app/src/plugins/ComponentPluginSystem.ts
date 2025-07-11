import { ComponentPlugin, ComponentConfig, PluginManager } from './types';

export class ComponentPluginSystem {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  /**
   * 获取所有启用的组件配置
   */
  getEnabledComponents(): ComponentConfig[] {
    const componentPlugins = this.pluginManager.getPluginsByType<ComponentPlugin>('component');
    return componentPlugins.flatMap(plugin => plugin.components);
  }

  /**
   * 根据名称获取组件
   */
  getComponentByName(name: string): ComponentConfig | undefined {
    const components = this.getEnabledComponents();
    return components.find(component => component.name === name);
  }

  /**
   * 根据分类获取组件
   */
  getComponentsByCategory(category: string): ComponentConfig[] {
    const components = this.getEnabledComponents();
    return components.filter(component => component.category === category);
  }

  /**
   * 获取所有组件分类
   */
  getAllCategories(): string[] {
    const components = this.getEnabledComponents();
    const categories = components.map(component => component.category).filter((category): category is string => Boolean(category));
    return [...new Set(categories)];
  }

  /**
   * 检查组件是否存在
   */
  hasComponent(name: string): boolean {
    return this.getComponentByName(name) !== undefined;
  }

  /**
   * 获取组件实例
   */
  getComponentInstance(name: string): any {
    const component = this.getComponentByName(name);
    return component?.component;
  }

  /**
   * 获取组件属性
   */
  getComponentProps(name: string): Record<string, any> {
    const component = this.getComponentByName(name);
    return component?.props || {};
  }

  /**
   * 动态渲染组件
   */
  renderComponent(name: string, props?: Record<string, any>): any {
    const component = this.getComponentByName(name);
    if (!component) {
      console.warn(`Component ${name} not found`);
      return null;
    }

    const Component = component.component;
    const defaultProps = component.props || {};
    const mergedProps = { ...defaultProps, ...props };

    return Component(mergedProps);
  }
}