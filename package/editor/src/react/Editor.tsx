import type { Extension } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';
import type { EditorPlugin } from '../core/types';
import type { ResizeConfig } from '../editor/types';
import { EditorContext } from './context';
import { useEditor } from './useEditor';
import { resolvePlugins } from '../core/plugin';
import { ReactToolbar } from '../toolbar/react/index';
import { ResizableWrapper } from './ResizableWrapper';

export interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  toolbar?: 'panel' | 'react' | false;
  theme?: Extension;
  className?: string;
  resize?: ResizeConfig;
}

export function Editor({
  value,
  onChange,
  plugins,
  keybindings,
  toolbar,
  theme,
  className,
  resize,
}: EditorProps) {
  const { containerRef, view } = useEditor({
    doc: value,
    plugins,
    keybindings,
    theme,
    onChange,
  });

  const toolbarItems = resolvePlugins(plugins ?? []).toolbar;
  const showReactToolbar = toolbar === 'react' && toolbarItems.length > 0;

  const inner = (
    <div
      className={resize ? undefined : className}
      style={resize ? {height: '100%', display: 'flex', flexDirection: 'column'} : undefined}
    >
      {showReactToolbar && <ReactToolbar items={toolbarItems} />}
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
