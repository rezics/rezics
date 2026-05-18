// Foundation v1 design tokens — single source of truth for rezics design system.
// See openspec/plans/design-system-research/briefs/01-foundation-v1.md.

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./radius";
export * from "./elevation";
export * from "./motion";

import {
  colors,
  lightColors,
  darkColors,
  type ColorScheme,
  type ColorTokens,
} from "./colors";
import { typography, type TypographyTokens } from "./typography";
import { spacing, type SpacingTokens } from "./spacing";
import { radius, type RadiusTokens } from "./radius";
import { elevation, type ElevationTokens } from "./elevation";
import { motion, type MotionTokens } from "./motion";

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
