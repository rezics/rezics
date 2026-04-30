import type { SeedPreset } from "@rezics/server/prisma/factory";
import { fast } from "./fast";
import { minimal } from "./minimal";
import { postTreeFocus } from "./post-tree-focus";
import { realistic } from "./realistic";

export const PRESETS: Record<string, SeedPreset> = {
  realistic,
  fast,
  minimal,
  "post-tree-focus": postTreeFocus,
};

export type PresetName = keyof typeof PRESETS;

export function listPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function getPreset(name: string): SeedPreset | undefined {
  return PRESETS[name];
}
