import { Editor } from '../react/Editor';
import type { CodeEditorProps } from './types';

export type { CodeEditorProps };

export function CodeEditor({
  value,
  onChange,
  theme,
  className,
  keybindings,
  plugins,
  resize,
}: CodeEditorProps) {
  return (
    <Editor
      value={value}
      onChange={onChange}
      plugins={plugins}
      keybindings={keybindings}
      toolbar={false}
      theme={theme}
      className={className}
      resize={resize}
    />
  );
}
