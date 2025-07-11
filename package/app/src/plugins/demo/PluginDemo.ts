import { PluginApp } from '../PluginApp';
import { ThemePlugin } from '../examples/ThemePlugin';

/**
 * 插件系统演示
 * 展示如何使用插件化架构系统
 */
export class PluginDemo {
  private pluginApp: PluginApp;

  constructor() {
    // 创建插件应用实例
    this.pluginApp = new PluginApp('BookReader', '2.0.0');
  }

  /**
   * 运行演示
   */
  async runDemo(): Promise<void> {
    console.log('🚀 开始插件系统演示...\n');

    try {
      // 1. 初始化应用
      await this.initializeApp();

      // 2. 注册插件
      await this.registerPlugins();

      // 3. 演示插件管理
      await this.demonstratePluginManagement();

      // 4. 演示插件系统功能
      await this.demonstratePluginSystems();

      // 5. 演示插件生命周期
      await this.demonstrateLifecycle();

      // 6. 演示错误处理
      await this.demonstrateErrorHandling();

      console.log('\n✅ 插件系统演示完成！');
    } catch (error) {
      console.error('❌ 演示过程中出现错误:', error);
    }
  }

  /**
   * 初始化应用
   */
  private async initializeApp(): Promise<void> {
    console.log('📱 初始化应用...');
    await this.pluginApp.initialize();
    
    const status = this.pluginApp.getStatus();
    console.log(`   应用状态: ${status.totalPlugins} 个插件, ${status.enabledPlugins} 个已启用\n`);
  }

  /**
   * 注册插件
   */
  private async registerPlugins(): Promise<void> {
    console.log('📦 注册插件...');

    // 注册主题插件
    this.pluginApp.registerPlugin(ThemePlugin);
    console.log('   ✅ 主题插件已注册');

    // 这里可以注册更多插件
    // this.pluginApp.registerPlugin(BookPlugin);
    // this.pluginApp.registerPlugin(UserPlugin);

    const status = this.pluginApp.getStatus();
    console.log(`   当前状态: ${status.totalPlugins} 个插件, ${status.enabledPlugins} 个已启用\n`);
  }

  /**
   * 演示插件管理
   */
  private async demonstratePluginManagement(): Promise<void> {
    console.log('🔧 演示插件管理...');

    const pluginManager = this.pluginApp.getPluginManager();

    // 获取所有插件
    const allPlugins = pluginManager.getAllPlugins();
    console.log(`   总插件数: ${allPlugins.length}`);

    // 获取插件统计信息
    const stats = this.pluginApp.getPluginStats();
    console.log('   插件统计:', stats);

    // 获取特定插件
    const themePlugin = pluginManager.getPlugin('theme-plugin');
    if (themePlugin) {
      console.log(`   主题插件状态: ${themePlugin.enabled ? '已启用' : '已禁用'}`);
    }

    // 获取插件状态
    const pluginStatus = pluginManager.getPluginStatus('theme-plugin');
    if (pluginStatus) {
      console.log('   插件详细信息:', pluginStatus);
    }

    console.log('');
  }

  /**
   * 演示插件系统功能
   */
  private async demonstratePluginSystems(): Promise<void> {
    console.log('⚙️ 演示插件系统功能...');

    // 演示主题系统
    await this.demonstrateThemeSystem();

    // 演示组件系统
    await this.demonstrateComponentSystem();

    // 演示功能系统
    await this.demonstrateFeatureSystem();

    console.log('');
  }

  /**
   * 演示主题系统
   */
  private async demonstrateThemeSystem(): Promise<void> {
    console.log('   🎨 主题系统:');

    const themeSystem = this.pluginApp.getThemeSystem();

    // 获取所有主题
    const themeNames = themeSystem.getAllThemeNames();
    console.log(`     可用主题: ${themeNames.join(', ')}`);

    // 获取主题预览
    const themePreviews = themeSystem.getAllThemePreviews();
    themePreviews.forEach(preview => {
      console.log(`     - ${preview.name}: ${preview.isDark ? '暗色' : '亮色'}主题`);
    });

    // 应用主题
    if (themeNames.length > 0) {
      const firstTheme = themeNames[0];
      if (firstTheme) {
        themeSystem.applyTheme(firstTheme);
        console.log(`     已应用主题: ${firstTheme}`);
      }
    }
  }

  /**
   * 演示组件系统
   */
  private async demonstrateComponentSystem(): Promise<void> {
    console.log('   🧩 组件系统:');

    const componentSystem = this.pluginApp.getComponentSystem();

    // 获取所有组件
    const components = componentSystem.getEnabledComponents();
    console.log(`     可用组件: ${components.length} 个`);

    // 获取组件分类
    const categories = componentSystem.getAllCategories();
    console.log(`     组件分类: ${categories.join(', ')}`);

    // 检查组件是否存在
    const hasComponent = componentSystem.hasComponent('BookCard');
    console.log(`     BookCard组件存在: ${hasComponent}`);
  }

  /**
   * 演示功能系统
   */
  private async demonstrateFeatureSystem(): Promise<void> {
    console.log('   ⚡ 功能系统:');

    const featureSystem = this.pluginApp.getFeatureSystem();

    // 获取所有功能
    const features = featureSystem.getEnabledFeatures();
    console.log(`     可用功能: ${features.length} 个`);

    // 获取功能分类
    const categories = featureSystem.getAllCategories();
    console.log(`     功能分类: ${categories.join(', ')}`);

    // 检查权限
    const userPermissions = ['book:read', 'user:view'];
    const canExecute = featureSystem.canExecuteFeature('searchBooks', userPermissions);
    console.log(`     用户是否有权限执行searchBooks: ${canExecute}`);
  }

  /**
   * 演示插件生命周期
   */
  private async demonstrateLifecycle(): Promise<void> {
    console.log('🔄 演示插件生命周期...');

    const pluginManager = this.pluginApp.getPluginManager();

    // 禁用插件
    console.log('   禁用主题插件...');
    pluginManager.disablePlugin('theme-plugin');

    // 启用插件
    console.log('   启用主题插件...');
    pluginManager.enablePlugin('theme-plugin');

    console.log('');
  }

  /**
   * 演示错误处理
   */
  private async demonstrateErrorHandling(): Promise<void> {
    console.log('⚠️ 演示错误处理...');

    const pluginManager = this.pluginApp.getPluginManager();

    try {
      // 尝试启用不存在的插件
      pluginManager.enablePlugin('non-existent-plugin');
    } catch (error) {
      console.log(`   捕获错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    try {
      // 尝试禁用被依赖的插件
      // 这里需要先创建一个有依赖关系的插件来演示
      console.log('   尝试禁用被依赖的插件...');
    } catch (error) {
      console.log(`   捕获依赖错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    console.log('');
  }

  /**
   * 获取插件应用实例
   */
  getPluginApp(): PluginApp {
    return this.pluginApp;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理资源...');
    await this.pluginApp.cleanup();
  }
}

/**
 * 运行演示的便捷函数
 */
export async function runPluginDemo(): Promise<void> {
  const demo = new PluginDemo();
  await demo.runDemo();
  await demo.cleanup();
}

/**
 * 创建演示实例的便捷函数
 */
export function createPluginDemo(): PluginDemo {
  return new PluginDemo();
}