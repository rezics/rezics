import type { ReactNode } from 'react';
import type { ToolbarItem } from '../toolbar/types';
import type { ToolbarOverride } from './types';

export function applyIconDefaults(
  items: ToolbarItem[],
  iconMap: Record<string, ReactNode>,
): ToolbarItem[] {
  return items.map((item) => {
    if (item.icon != null) return item;
    const icon = iconMap[item.name];
    if (icon == null) return item;
    return { ...item, icon };
  });
}

export function applyToolbarOverrides(
  items: ToolbarItem[],
  override: ToolbarOverride | undefined,
): ToolbarItem[] {
  if (!override) return items;

  let result = items;

  if (override.icons) {
    const iconOverrides = override.icons;
    result = result.map((item) => {
      const icon = iconOverrides[item.name];
      if (icon == null) return item;
      return { ...item, icon };
    });
  }

  if (override.extend) {
    result = override.extend(result);
  }

  return result;
}
