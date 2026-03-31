import { describe, expect, it } from 'bun:test';
import { resolvePlugins } from '../core/plugin';

describe('CodeEditor composition', () => {
  it('no default plugins produces empty toolbar and extensions', () => {
    const resolved = resolvePlugins([]);

    expect(resolved.toolbar).toHaveLength(0);
    expect(resolved.extensions).toHaveLength(0);
    expect(resolved.keybindings).toHaveLength(0);
  });

  it('consumer plugins are forwarded', () => {
    const custom = {
      name: 'custom',
      extensions: [],
      toolbar: [
        { name: 'test', label: 'Test', action: () => {} },
      ],
    };
    const resolved = resolvePlugins([custom]);

    expect(resolved.toolbar).toHaveLength(1);
    expect(resolved.toolbar[0].name).toBe('test');
  });
});
