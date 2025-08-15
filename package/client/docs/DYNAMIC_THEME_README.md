# 动态主题系统实现文档

本文档介绍了基于 `@material/material-color-utilities`
实现的动态主题系统，该系统能够根据用户选择的种子颜色自动生成协调的 Material
Design 3 配色方案。

## 📁 文件结构

```
src/
├── config/
│   ├── theme.ts                    # 原有主题配置
│   └── dynamicTheme.ts            # 新增：动态主题工具
├── component/
│   └── Theme/
│       ├── ThemeCustomizer.tsx    # 主题自定义组件
│       └── ThemeDemo.tsx          # 主题演示页面
├── global/
│   └── appStore.ts               # 应用状态管理（已扩展）
└── index.tsx                     # 主应用入口（已更新）
```

## 🎨 核心功能

### 1. 动态颜色生成

- **文件**: `src/config/dynamicTheme.ts`
- **功能**: 基于单一种子颜色生成完整的 Material Design 3 配色方案
- **特点**:
  - 自动计算主色、次色、第三色及其变体
  - 支持亮色和暗色模式
  - 生成符合无障碍标准的对比度

### 2. 主题自定义界面

- **文件**: `src/component/Theme/ThemeCustomizer.tsx`
- **功能**: 提供用户友好的主题自定义界面
- **特性**:
  - 预设颜色选择器
  - 自定义十六进制颜色输入
  - 从图片提取主色调
  - 动态主题开关
  - 实时预览

### 3. 状态管理扩展

- **文件**: `src/global/appStore.ts`
- **新增状态**:
  - `customColor`: 用户选择的自定义颜色
  - `useDynamicTheme`: 是否启用动态主题
- **新增操作**:
  - `setCustomColor`: 设置自定义颜色
  - `setUseDynamicTheme`: 切换动态主题

## 🔧 主要 API

### generateDynamicColors

```typescript
function generateDynamicColors(
	sourceColor: string,
	isDark: boolean,
): DynamicColorScheme;
```

根据种子颜色生成完整的动态颜色方案。

**参数**:

- `sourceColor`: 十六进制种子颜色 (如 "#FF5722")
- `isDark`: 是否为暗色模式

**返回**: 包含所有 Material Design 3 颜色的对象

### dynamicColorsToPalette

```typescript
function dynamicColorsToPalette(
	colors: DynamicColorScheme,
	mode: "light" | "dark",
): PaletteOptions;
```

将动态颜色方案转换为 Material-UI 调色板选项。

### getDynamicTheme

```typescript
function getDynamicTheme(mode: "light" | "dark", sourceColor?: string): Theme;
```

生成动态主题对象，如果未提供 `sourceColor` 则回退到默认主题。

### extractColorFromImage

```typescript
async function extractColorFromImage(imageUrl: string): Promise<string>;
```

从图片中提取主色调，用于自动生成主题颜色。

## 🎯 使用方法

### 1. 启用动态主题

```typescript
import { appStore } from "@/global/appStore";

// 启用动态主题
appStore.getState().setUseDynamicTheme(true);

// 设置自定义颜色
appStore.getState().setCustomColor("#FF5722");
```

### 2. 在组件中使用

```typescript
import { ThemeQuickToggle } from "@/component/Theme/ThemeCustomizer";

// 在布局中添加主题自定义按钮
<ThemeQuickToggle />;
```

### 3. 手动生成动态主题

```typescript
import { generateDynamicColors, getDynamicTheme } from "@/config/dynamicTheme";

// 生成动态颜色
const colors = generateDynamicColors("#FF5722", false);

// 创建主题
const theme = getDynamicTheme("light", "#FF5722");
```

## 🌈 预设颜色

系统提供了丰富的预设颜色选项：

```typescript
export const PRESET_COLORS = {
	red: "#f44336",
	pink: "#e91e63",
	purple: "#9c27b0",
	deepPurple: "#673ab7",
	indigo: "#3f51b5",
	blue: "#2196f3",
	lightBlue: "#03a9f4",
	cyan: "#00bcd4",
	teal: "#009688",
	green: "#4caf50",
	lightGreen: "#8bc34a",
	lime: "#cddc39",
	yellow: "#ffeb3b",
	amber: "#ffc107",
	orange: "#ff9800",
	deepOrange: "#ff5722",
	brown: "#795548",
	grey: "#9e9e9e",
	blueGrey: "#607d8b",
	// 自定义颜色
	coral: "#f4606c",
	mint: "#00d4aa",
	lavender: "#b19cd9",
	peach: "#ffab91",
	sage: "#a5d6a7",
};
```

## 🎨 主题演示

### 查看演示页面

使用 `ThemeDemo` 组件可以查看动态主题的效果：

```typescript
import { ThemeDemo } from "@/component/Theme/ThemeDemo";

<ThemeDemo />;
```

演示页面包含：

- 颜色系统展示
- 各种 Material-UI 组件
- 不同状态的界面元素
- 响应式卡片布局

## 🔄 集成流程

### 1. 安装依赖

```bash
pnpm add @material/material-color-utilities
```

### 2. 更新主应用

在 `src/index.tsx` 中集成动态主题：

```typescript
import { getDynamicTheme } from "./config/theme";
import {
	applyDynamicThemeToDOM,
	generateDynamicColors,
} from "./config/dynamicTheme";

const theme = useMemo(() => {
	if (useDynamicTheme && customColor) {
		const dynamicColors = generateDynamicColors(
			customColor,
			themeMode === "dark",
		);
		applyDynamicThemeToDOM(dynamicColors, themeMode === "dark");
		return getDynamicTheme(themeMode, customColor);
	}
	return getTheme(themeMode);
}, [themeMode, customColor, useDynamicTheme]);
```

### 3. 添加主题控制

在布局组件中添加主题自定义按钮：

```typescript
import { ThemeQuickToggle } from "@/component/Theme/ThemeCustomizer";

<ThemeQuickToggle />;
```

## 🎯 特性亮点

### 1. Material Design 3 兼容

- 完全遵循 Material Design 3 规范
- 自动生成协调的配色方案
- 支持动态颜色系统

### 2. 用户体验优化

- 直观的颜色选择界面
- 实时预览效果
- 从图片提取颜色
- 预设颜色快速选择

### 3. 开发者友好

- TypeScript 完整支持
- 模块化设计
- 易于扩展和自定义
- 与现有主题系统无缝集成

### 4. 性能优化

- 颜色计算缓存
- 按需生成主题
- 最小化重新渲染

## 🔧 自定义扩展

### 添加新的预设颜色

```typescript
// 在 dynamicTheme.ts 中扩展 PRESET_COLORS
export const PRESET_COLORS = {
	...existingColors,
	myCustomColor: "#your-color-here",
};
```

### 自定义颜色映射

```typescript
// 修改 dynamicColorsToPalette 函数来自定义颜色映射
export function dynamicColorsToPalette(
	colors: DynamicColorScheme,
	mode: "light" | "dark",
): PaletteOptions {
	return {
		// 自定义你的颜色映射逻辑
	};
}
```

### 扩展主题自定义界面

```typescript
// 在 ThemeCustomizer.tsx 中添加新的自定义选项
// 例如：字体大小、圆角大小等
```

## 📱 响应式支持

动态主题系统完全支持响应式设计：

- 移动端友好的颜色选择器
- 自适应布局
- 触摸优化的交互

## 🔍 调试和开发

### 查看生成的颜色

```typescript
import { generateDynamicColors } from "@/config/dynamicTheme";

const colors = generateDynamicColors("#FF5722", false);
console.log("Generated colors:", colors);
```

### CSS 自定义属性

动态主题会自动设置 CSS 自定义属性，可以在开发者工具中查看：

```css
:root {
	--md-sys-color-primary: #ff5722;
	--md-sys-color-on-primary: #ffffff;
	/* ... 更多颜色变量 */
}
```

## 🚀 未来扩展

### 计划中的功能

1. **主题预设管理**: 保存和管理用户自定义主题
2. **主题分享**: 生成主题代码供分享
3. **高级颜色调整**: 色调、饱和度、亮度微调
4. **动画过渡**: 主题切换时的平滑动画
5. **系统主题同步**: 跟随系统外观设置

### 性能优化

1. **颜色计算缓存**: 避免重复计算相同颜色
2. **懒加载**: 按需加载主题自定义组件
3. **Web Worker**: 在后台线程中进行颜色计算

## 📄 许可证

本动态主题系统基于项目的开源许可证，可自由使用和修改。

---

通过这个动态主题系统，用户可以轻松地自定义应用的外观，而开发者则可以享受到
Material Design 3 带来的现代化设计体验。
