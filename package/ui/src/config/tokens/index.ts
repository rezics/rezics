// Foundation design tokens — single source of truth for the rezics design system
// (color, typography, spacing, radius, elevation, motion). Consumed by
// package/ui/src/config/uno-config.ts, which emits them as the flat UnoCSS
// custom-property cascade (`--colors-*`, `--radius-*`, etc.). Light/dark switches
// via the `dark` class on <html>; there is no JS theme provider.
//
// Foundation 设计 token——rezics 设计系统的唯一可信源
//（颜色、排版、间距、圆角、层级、动效）。由
// package/ui/src/config/uno-config.ts 消费，它将其输出为扁平的 UnoCSS
// 自定义属性级联（`--colors-*`、`--radius-*` 等）。明暗模式通过 <html> 上的
// `dark` 类切换；没有 JS 主题 provider。

export * from "./colors";
export * from "./elevation";
export * from "./motion";
export * from "./radius";
export * from "./spacing";
export * from "./typography";

import {
  type ColorScheme,
  type ColorTokens,
  colors,
  darkColors,
  lightColors,
} from "./colors";
import { type ElevationTokens, elevation } from "./elevation";
import { type MotionTokens, motion } from "./motion";
import { type RadiusTokens, radius } from "./radius";
import { type SpacingTokens, spacing } from "./spacing";
import { type TypographyTokens, typography } from "./typography";

export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  elevation,
  motion,
} as const;

export interface DesignTokens {
  colors: Record<ColorScheme, ColorTokens>;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
}

export const lightTokens = {
  colors: lightColors,
  typography,
  spacing,
  radius,
  elevation: elevation.light,
  motion,
} as const;

export const darkTokens = {
  colors: darkColors,
  typography,
  spacing,
  radius,
  elevation: elevation.dark,
  motion,
} as const;
