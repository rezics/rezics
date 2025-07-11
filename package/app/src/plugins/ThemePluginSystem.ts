import { ThemePlugin, ThemeConfig, PluginManager } from './types';

export class ThemePluginSystem {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  /**
   * 获取所有启用的主题配置
   */
  getEnabledThemes(): ThemeConfig[] {
    const themePlugins = this.pluginManager.getPluginsByType<ThemePlugin>('theme');
    return themePlugins.flatMap(plugin => plugin.themes);
  }

  /**
   * 根据名称获取主题
   */
  getThemeByName(name: string): ThemeConfig | undefined {
    const themes = this.getEnabledThemes();
    return themes.find(theme => theme.name === name);
  }

  /**
   * 获取所有主题名称
   */
  getAllThemeNames(): string[] {
    return this.getEnabledThemes().map(theme => theme.name);
  }

  /**
   * 检查主题是否存在
   */
  hasTheme(name: string): boolean {
    return this.getThemeByName(name) !== undefined;
  }

  /**
   * 获取主题对象
   */
  getThemeObject(name: string): any {
    const theme = this.getThemeByName(name);
    return theme?.theme;
  }

  /**
   * 获取主题是否为暗色主题
   */
  isDarkTheme(name: string): boolean {
    const theme = this.getThemeByName(name);
    return theme?.isDark || false;
  }

  /**
   * 获取主题的自定义颜色
   */
  getThemeCustomColors(name: string): string[] {
    const theme = this.getThemeByName(name);
    return theme?.customColors || [];
  }

  /**
   * 获取所有暗色主题
   */
  getDarkThemes(): ThemeConfig[] {
    return this.getEnabledThemes().filter(theme => theme.isDark);
  }

  /**
   * 获取所有亮色主题
   */
  getLightThemes(): ThemeConfig[] {
    return this.getEnabledThemes().filter(theme => !theme.isDark);
  }

  /**
   * 根据颜色获取匹配的主题
   */
  getThemesByColor(color: string): ThemeConfig[] {
    return this.getEnabledThemes().filter(theme => 
      theme.customColors?.includes(color)
    );
  }

  /**
   * 应用主题到DOM
   */
  applyTheme(name: string): void {
    const theme = this.getThemeByName(name);
    if (!theme) {
      console.warn(`Theme ${name} not found`);
      return;
    }

    try {
      // 这里可以添加应用主题到DOM的逻辑
      // 例如：设置CSS变量、更新document.body的className等
      console.log(`Theme ${name} applied successfully`);
    } catch (error) {
      console.error(`Error applying theme ${name}:`, error);
    }
  }

  /**
   * 获取主题预览信息
   */
  getThemePreview(name: string): {
    name: string;
    isDark: boolean;
    customColors: string[];
    description?: string;
  } {
    const theme = this.getThemeByName(name);
    if (!theme) {
      throw new Error(`Theme ${name} not found`);
    }

    return {
      name: theme.name,
      isDark: theme.isDark || false,
      customColors: theme.customColors || [],
      description: theme.name // 可以扩展主题配置添加描述字段
    };
  }

  /**
   * 获取所有主题预览信息
   */
  getAllThemePreviews(): Array<{
    name: string;
    isDark: boolean;
    customColors: string[];
    description?: string;
  }> {
    return this.getAllThemeNames().map(name => this.getThemePreview(name));
  }
}