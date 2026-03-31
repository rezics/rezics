import { describe, expect, it } from 'bun:test';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';
import type { ToolbarItem } from '../toolbar/types';

const noop = () => {};

function makeItem(overrides: Partial<ToolbarItem> & { name: string }): ToolbarItem {
  return { label: overrides.name, action: noop, ...overrides };
}

describe('applyIconDefaults', () => {
  it('sets icon from map when item has no icon', () => {
    const items = [makeItem({ name: 'bold' }), makeItem({ name: 'italic' })];
    const iconMap = { bold: 'bold-icon', italic: 'italic-icon' };

    const result = applyIconDefaults(items, iconMap);

    expect(result[0].icon).toBe('bold-icon');
    expect(result[1].icon).toBe('italic-icon');
  });

  it('does not override existing icon', () => {
    const items = [makeItem({ name: 'bold', icon: 'custom-icon' })];
    const iconMap = { bold: 'default-icon' };

    const result = applyIconDefaults(items, iconMap);

    expect(result[0].icon).toBe('custom-icon');
  });

  it('leaves items without a map entry unchanged', () => {
    const items = [makeItem({ name: 'unknown' })];
    const iconMap = { bold: 'bold-icon' };

    const result = applyIconDefaults(items, iconMap);

    expect(result[0].icon).toBeUndefined();
  });
});

describe('applyToolbarOverrides', () => {
  it('returns items unchanged when no override provided', () => {
    const items = [makeItem({ name: 'bold', icon: 'icon' })];

    const result = applyToolbarOverrides(items, undefined);

    expect(result).toBe(items);
  });

  it('replaces icons by name from override.icons', () => {
    const items = [
      makeItem({ name: 'bold', icon: 'default' }),
      makeItem({ name: 'italic', icon: 'default' }),
    ];

    const result = applyToolbarOverrides(items, {
      icons: { bold: 'custom-bold' },
    });

    expect(result[0].icon).toBe('custom-bold');
    expect(result[1].icon).toBe('default');
  });

  it('calls extend with icon-overridden items', () => {
    const items = [makeItem({ name: 'bold', icon: 'default' })];
    const custom = makeItem({ name: 'custom', icon: 'x' });

    const result = applyToolbarOverrides(items, {
      icons: { bold: 'replaced' },
      extend: (items) => [...items, custom],
    });

    expect(result).toHaveLength(2);
    expect(result[0].icon).toBe('replaced');
    expect(result[1].name).toBe('custom');
  });

  it('applies extend without icons', () => {
    const items = [makeItem({ name: 'bold' })];

    const result = applyToolbarOverrides(items, {
      extend: (items) => items.filter((i) => i.name !== 'bold'),
    });

    expect(result).toHaveLength(0);
  });
});
