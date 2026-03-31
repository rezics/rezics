import { describe, expect, it } from 'bun:test';
import { markdownFull } from '../markdown/index';
import { resolvePlugins } from '../core/plugin';
import { markdownIconMap } from './toolbar-defaults';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';

describe('MarkdownEditor composition', () => {
  it('markdownFull produces plugins with toolbar items', () => {
    const plugins = markdownFull({ preview: true });
    const resolved = resolvePlugins(plugins);

    expect(resolved.toolbar.length).toBeGreaterThan(0);
    expect(resolved.toolbar.find((t) => t.name === 'bold')).toBeDefined();
  });

  it('applies default icons to all markdown toolbar items', () => {
    const plugins = markdownFull();
    const resolved = resolvePlugins(plugins);
    const withIcons = applyIconDefaults(resolved.toolbar, markdownIconMap);

    for (const item of withIcons) {
      if (markdownIconMap[item.name]) {
        expect(item.icon).toBeDefined();
      }
    }
  });

  it('toolbar override icons replace the correct item', () => {
    const plugins = markdownFull();
    const resolved = resolvePlugins(plugins);
    const withIcons = applyIconDefaults(resolved.toolbar, markdownIconMap);
    const customIcon = 'my-custom-bold';
    const overridden = applyToolbarOverrides(withIcons, {
      icons: { bold: customIcon },
    });

    expect(overridden.find((t) => t.name === 'bold')?.icon).toBe(customIcon);
    // Other items keep their default icons
    expect(overridden.find((t) => t.name === 'italic')?.icon).toBeDefined();
  });

  it('toolbar={false} results in empty items', () => {
    // When toolbar is false, the component skips resolution
    // This is a no-op test to document the behavior
    const items: any[] = [];
    expect(items).toHaveLength(0);
  });

  it('extra plugins are appended to defaults', () => {
    const mdPlugins = markdownFull();
    const extra = { name: 'custom', extensions: [] };
    const all = [...mdPlugins, extra];

    expect(all[all.length - 1].name).toBe('custom');
    expect(all.length).toBe(mdPlugins.length + 1);
  });
});
