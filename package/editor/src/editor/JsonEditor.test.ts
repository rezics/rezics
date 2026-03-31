import { describe, expect, it } from 'bun:test';
import { jsonFull } from '../json/index';
import { resolvePlugins } from '../core/plugin';
import { jsonIconMap } from './toolbar-defaults';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';

describe('JsonEditor composition', () => {
  it('jsonFull produces plugins with format toolbar item', () => {
    const plugins = jsonFull();
    const resolved = resolvePlugins(plugins);

    expect(resolved.toolbar.find((t) => t.name === 'format')).toBeDefined();
  });

  it('applies default icon to format button', () => {
    const plugins = jsonFull();
    const resolved = resolvePlugins(plugins);
    const withIcons = applyIconDefaults(resolved.toolbar, jsonIconMap);

    const format = withIcons.find((t) => t.name === 'format');
    expect(format?.icon).toBeDefined();
  });

  it('lint={false} excludes linting plugin', () => {
    const withLint = jsonFull({ lint: true });
    const withoutLint = jsonFull({ lint: false });

    expect(withoutLint.length).toBeLessThan(withLint.length);
  });

  it('toolbar override replaces format icon', () => {
    const plugins = jsonFull();
    const resolved = resolvePlugins(plugins);
    const withIcons = applyIconDefaults(resolved.toolbar, jsonIconMap);
    const customIcon = 'custom-format';
    const overridden = applyToolbarOverrides(withIcons, {
      icons: { format: customIcon },
    });

    expect(overridden.find((t) => t.name === 'format')?.icon).toBe(customIcon);
  });
});
