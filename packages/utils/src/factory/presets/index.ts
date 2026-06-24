import type { SeedPreset } from "@rezics/server/db/seed-factory";
import { bookMultiLinkToc } from "./book-multi-link-toc";
import { fast } from "./fast";
import { medium } from "./medium";
import { minimal } from "./minimal";
import { postTreeFocus } from "./post-tree-focus";
import { realistic } from "./realistic";

export const PRESETS: Record<string, SeedPreset> = {
  realistic,
  fast,
  medium,
  minimal,
  "post-tree-focus": postTreeFocus,
  "book-multi-link-toc": bookMultiLinkToc,
};

export type PresetName = keyof typeof PRESETS;

export function listPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function getPreset(name: string): SeedPreset | undefined {
  return PRESETS[name];
}
