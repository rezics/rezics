import type { Extension } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';
import type { EditorPlugin } from '../core/types';
import { EditorContext } from './context';
import { useEditor } from './useEditor';
import { resolvePlugins } from '../core/plugin';
import { ReactToolbar } from '../toolbar/react/index';

export interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  toolbar?: 'panel' | 'react' | false;
  theme?: Extension;
  className?: string;
}

export function Editor({
  value,
  onChange,
  plugins,
  keybindings,
  toolbar,
  theme,
  className,
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

  return (
    <EditorContext.Provider value={view}>
      <div className={className}>
        {showReactToolbar && <ReactToolbar items={toolbarItems} />}
        <div ref={containerRef} />
      </div>
    </EditorContext.Provider>
  );
}
