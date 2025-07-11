import React from 'react';
import { Route, Switch } from 'wouter';
import { RoutePlugin, RouteConfig, PluginManager } from './types';

interface RoutePluginSystemProps {
  pluginManager: PluginManager;
  fallbackComponent?: React.ComponentType;
}

export class RoutePluginSystem {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  /**
   * 获取所有启用的路由配置
   */
  getEnabledRoutes(): RouteConfig[] {
    const routePlugins = this.pluginManager.getPluginsByType<RoutePlugin>('route');
    return routePlugins.flatMap(plugin => plugin.routes);
  }

  /**
   * 根据路径获取路由配置
   */
  getRouteByPath(path: string): RouteConfig | undefined {
    const routes = this.getEnabledRoutes();
    return routes.find(route => route.path === path);
  }

  /**
   * 获取所有路由路径
   */
  getAllPaths(): string[] {
    return this.getEnabledRoutes().map(route => route.path);
  }

  /**
   * 检查路径是否存在
   */
  hasRoute(path: string): boolean {
    return this.getRouteByPath(path) !== undefined;
  }

  /**
   * 渲染路由组件
   */
  renderRoutes(fallbackComponent?: React.ComponentType): React.ReactElement {
    const routes = this.getEnabledRoutes();

    return (
      <Switch>
        {routes.map((routeConfig, index) => (
          <Route key={`${routeConfig.path}-${index}`} path={routeConfig.path}>
            {() => {
              const Component = routeConfig.component;
              const Layout = routeConfig.layout;

              if (Layout) {
                return (
                  <Layout>
                    <Component />
                  </Layout>
                );
              }

              return <Component />;
            }}
          </Route>
        ))}
        
        {/* 404 回退路由 */}
        {fallbackComponent && (
          <Route>
            <fallbackComponent />
          </Route>
        )}
      </Switch>
    );
  }
}

/**
 * 路由插件系统组件
 */
export const RoutePluginSystemComponent: React.FC<RoutePluginSystemProps> = ({
  pluginManager,
  fallbackComponent
}) => {
  const routeSystem = new RoutePluginSystem(pluginManager);
  return routeSystem.renderRoutes(fallbackComponent);
};