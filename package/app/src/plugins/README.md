# 插件化架构系统

这是一个人性化的插件化架构系统，为应用提供了模块化、可扩展的插件管理能力。

## 🚀 特性

- **模块化设计**: 将应用功能拆分为独立的插件
- **动态加载**: 支持插件的动态注册、启用、禁用
- **类型安全**: 完整的 TypeScript 类型支持
- **生命周期管理**: 插件的安装、卸载、启用、禁用生命周期
- **依赖管理**: 插件间的依赖关系管理
- **可视化界面**: 提供插件管理界面

## 📦 插件类型

### 1. 路由插件 (Route Plugin)
管理应用的路由配置，支持动态路由注册。

```typescript
import { RoutePlugin } from './plugins/types';

const myRoutePlugin: RoutePlugin = {
  id: 'my-route-plugin',
  name: 'My Route Plugin',
  version: '1.0.0',
  type: 'route',
  enabled: true,
  routes: [
    {
      path: '/my-page',
      component: MyPageComponent,
      layout: MyLayoutComponent,
      meta: {
        title: 'My Page',
        icon: '📄',
        requiresAuth: false
      }
    }
  ]
};
```

### 2. 组件插件 (Component Plugin)
提供可复用的UI组件。

```typescript
import { ComponentPlugin } from './plugins/types';

const myComponentPlugin: ComponentPlugin = {
  id: 'my-component-plugin',
  name: 'My Component Plugin',
  version: '1.0.0',
  type: 'component',
  enabled: true,
  components: [
    {
      name: 'MyButton',
      component: MyButtonComponent,
      category: 'ui',
      props: {
        variant: 'contained',
        color: 'primary'
      }
    }
  ]
};
```

### 3. 功能插件 (Feature Plugin)
提供业务功能逻辑。

```typescript
import { FeaturePlugin } from './plugins/types';

const myFeaturePlugin: FeaturePlugin = {
  id: 'my-feature-plugin',
  name: 'My Feature Plugin',
  version: '1.0.0',
  type: 'feature',
  enabled: true,
  features: [
    {
      name: 'processData',
      handler: (data: any) => {
        // 处理数据的逻辑
        return processedData;
      },
      category: 'data',
      permissions: ['data:process']
    }
  ]
};
```

### 4. 主题插件 (Theme Plugin)
管理应用的主题配置。

```typescript
import { ThemePlugin } from './plugins/types';

const myThemePlugin: ThemePlugin = {
  id: 'my-theme-plugin',
  name: 'My Theme Plugin',
  version: '1.0.0',
  type: 'theme',
  enabled: true,
  themes: [
    {
      name: 'my-theme',
      theme: myThemeObject,
      isDark: false,
      customColors: ['#1976d2', '#dc004e']
    }
  ]
};
```

## 🛠️ 使用方法

### 1. 初始化插件应用

```typescript
import { PluginApp } from './plugins/PluginApp';

// 创建插件应用实例
const pluginApp = new PluginApp('MyApp', '1.0.0');

// 初始化应用
await pluginApp.initialize();
```

### 2. 注册插件

```typescript
import { BookPlugin } from './plugins/examples/BookPlugin';
import { ThemePlugin } from './plugins/examples/ThemePlugin';

// 注册单个插件
pluginApp.registerPlugin(BookPlugin);

// 批量注册插件
pluginApp.registerPlugins([BookPlugin, ThemePlugin]);
```

### 3. 使用插件系统

```typescript
// 获取路由系统
const routeSystem = pluginApp.getRouteSystem();
const routes = routeSystem.getEnabledRoutes();

// 获取组件系统
const componentSystem = pluginApp.getComponentSystem();
const component = componentSystem.getComponentByName('BookCard');

// 获取功能系统
const featureSystem = pluginApp.getFeatureSystem();
const result = await featureSystem.executeFeatureAsync('searchBooks', 'query');

// 获取主题系统
const themeSystem = pluginApp.getThemeSystem();
const themes = themeSystem.getAllThemeNames();
```

### 4. 插件管理

```typescript
const pluginManager = pluginApp.getPluginManager();

// 启用插件
pluginManager.enablePlugin('book-plugin');

// 禁用插件
pluginManager.disablePlugin('book-plugin');

// 获取插件状态
const status = pluginManager.getPluginStatus('book-plugin');

// 获取所有插件
const allPlugins = pluginManager.getAllPlugins();
```

## 🔧 插件生命周期

每个插件都可以实现以下生命周期钩子：

```typescript
const myPlugin: ExtendedPlugin = {
  // ... 其他配置

  // 插件安装时调用
  onInstall: async (context) => {
    console.log('Plugin installed');
    context.utils.showNotification('Plugin installed successfully', 'success');
  },

  // 插件卸载时调用
  onUninstall: async (context) => {
    console.log('Plugin uninstalled');
    context.utils.showNotification('Plugin uninstalled', 'warning');
  },

  // 插件启用时调用
  onEnable: async (context) => {
    console.log('Plugin enabled');
    context.utils.showNotification('Plugin enabled', 'success');
  },

  // 插件禁用时调用
  onDisable: async (context) => {
    console.log('Plugin disabled');
    context.utils.showNotification('Plugin disabled', 'warning');
  }
};
```

## 📊 插件上下文

插件可以通过上下文访问应用信息和工具函数：

```typescript
interface PluginContext {
  manager: PluginManager;        // 插件管理器
  app: {
    version: string;            // 应用版本
    name: string;              // 应用名称
  };
  utils: {
    navigate: (path: string) => void;                    // 导航函数
    showNotification: (message: string, type?: 'success' | 'error' | 'warning') => void;  // 通知函数
  };
}
```

## 🎨 插件管理界面

系统提供了可视化的插件管理界面：

```typescript
import { PluginManagerUI } from './plugins/components/PluginManagerUI';

// 在React组件中使用
<PluginManagerUI pluginApp={pluginApp} />
```

## 🔒 权限管理

插件可以定义权限要求：

```typescript
{
  name: 'adminFeature',
  handler: adminFunction,
  permissions: ['admin:access', 'user:manage']
}
```

系统会检查用户权限来决定是否允许执行功能。

## 📝 最佳实践

1. **插件命名**: 使用有意义的插件ID和名称
2. **版本管理**: 为插件指定版本号，便于管理
3. **依赖管理**: 明确声明插件间的依赖关系
4. **错误处理**: 在插件生命周期钩子中处理异常
5. **文档化**: 为插件提供清晰的描述和使用说明
6. **测试**: 为插件编写单元测试

## 🚀 扩展性

系统设计为高度可扩展的架构：

- 可以轻松添加新的插件类型
- 支持插件的热更新
- 提供插件市场机制
- 支持插件的远程加载

## 📚 示例

查看 `examples/` 目录中的示例插件：

- `BookPlugin.ts` - 书籍管理插件示例
- `ThemePlugin.ts` - 主题管理插件示例

这些示例展示了如何创建和使用不同类型的插件。