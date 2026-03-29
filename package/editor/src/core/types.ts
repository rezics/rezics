import type { Extension } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';
import type { ToolbarItem } from '../toolbar/types';

export interface EditorPlugin {
  name: string;
  extensions?: Extension | Extension[];
  keybindings?: KeyBinding[];
  toolbar?: ToolbarItem[];
}

export type EditorPluginFactory<T = void> = T extends void
  ? () => EditorPlugin
  : (config?: T) => EditorPlugin;

export interface EditorConfig {
  doc?: string;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  theme?: Extension;
}
