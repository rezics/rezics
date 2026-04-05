import { useEffect, useMemo } from 'react';
import { EditorContext } from '../react/context';
import { useEditor } from '../react/useEditor';
import { jsonFull } from '../json/index';
import { resolvePlugins } from '../core/plugin';
import { ReactToolbar } from '../toolbar/react/index';
import { jsonIconMap } from './toolbar-defaults';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';
import { ResizableWrapper } from '../react/ResizableWrapper';
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
  resize,
  viewRef,
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

  useEffect(() => {
    viewRef?.(view);
  }, [view, viewRef]);

  const hasCustomRender = toolbar !== false && toolbar?.render != null;
  const showDefaultToolbar =
    toolbar !== false && !hasCustomRender && toolbarItems.length > 0;

  const inner = (
    <div
      className={resize ? undefined : className}
      style={resize ? {height: '100%', display: 'flex', flexDirection: 'column'} : undefined}
    >
      {hasCustomRender && view && toolbar!.render!(toolbarItems, view)}
      {showDefaultToolbar && <ReactToolbar items={toolbarItems} />}
      <div ref={containerRef} style={resize ? {flex: 1, overflow: 'auto'} : undefined} />
    </div>
  );

  return (
    <EditorContext.Provider value={view}>
      {resize ? (
        <ResizableWrapper config={resize} className={className}>
          {inner}
        </ResizableWrapper>
      ) : (
        inner
      )}
    </EditorContext.Provider>
  );
}
