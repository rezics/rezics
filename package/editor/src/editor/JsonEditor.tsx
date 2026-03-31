import { useMemo } from 'react';
import { EditorContext } from '../react/context';
import { useEditor } from '../react/useEditor';
import { jsonFull } from '../json/index';
import { resolvePlugins } from '../core/plugin';
import { ReactToolbar } from '../toolbar/react/index';
import { jsonIconMap } from './toolbar-defaults';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';
import type { JsonEditorProps } from './types';

export type { JsonEditorProps };

export function JsonEditor({
  value,
  onChange,
  theme,
  className,
  keybindings,
  plugins: extraPlugins,
  lint = true,
  toolbar,
}: JsonEditorProps) {
  const allPlugins = useMemo(() => {
    const jsonPlugins = jsonFull({ lint });
    return extraPlugins ? [...jsonPlugins, ...extraPlugins] : jsonPlugins;
  }, [lint, extraPlugins]);

  const toolbarItems = useMemo(() => {
    if (toolbar === false) return [];
    const resolved = resolvePlugins(allPlugins).toolbar;
    const withIcons = applyIconDefaults(resolved, jsonIconMap);
    return applyToolbarOverrides(withIcons, toolbar);
  }, [allPlugins, toolbar]);

  const { containerRef, view } = useEditor({
    doc: value,
    plugins: allPlugins,
    keybindings,
    theme,
    onChange,
  });

  const hasCustomRender = toolbar !== false && toolbar?.render != null;
  const showDefaultToolbar =
    toolbar !== false && !hasCustomRender && toolbarItems.length > 0;

  return (
    <EditorContext.Provider value={view}>
      <div className={className}>
        {hasCustomRender && view && toolbar!.render!(toolbarItems, view)}
        {showDefaultToolbar && <ReactToolbar items={toolbarItems} />}
        <div ref={containerRef} />
      </div>
    </EditorContext.Provider>
  );
}
