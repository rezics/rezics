// Foundation v1 design tokens — single source of truth for rezics design system.
// See openspec/plans/design-system-research/briefs/01-foundation-v1.md.

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
