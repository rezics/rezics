import type { Extension } from '@codemirror/state';
import type { EditorView, KeyBinding } from '@codemirror/view';
import type { ReactNode, RefCallback } from 'react';
import type { EditorPlugin } from '../core/types';
import type { ToolbarItem } from '../toolbar/types';
import type { MentionConfig } from '../markdown/mention/index';
import type { EmojiConfig } from '../markdown/emoji/index';
import type { PreviewConfig } from '../markdown/preview/index';

export interface ToolbarOverride {
  /** Replace default icons by toolbar item name */
  icons?: Record<string, ReactNode>;

  /** Transform the default toolbar items array.
   *  Receives items with icons already applied.
   *  Return the final items array. */
  extend?: (items: ToolbarItem[]) => ToolbarItem[];

  /** Fully replace the toolbar rendering.
   *  Receives the final items array and the EditorView. */
  render?: (items: ToolbarItem[], view: EditorView) => ReactNode;
}

export interface ResizeConfig {
  /** Initial height in pixels. Enables fixed-height mode. */
  height: number;
  /** Minimum height in pixels. Default: 100 */
  minHeight?: number;
  /** Maximum height in pixels. Default: unlimited */
  maxHeight?: number;
  /** Called when the user finishes dragging. Receives final height. */
  onHeightChange?: (height: number) => void;
}

export interface BaseEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  theme?: Extension;
  className?: string;
  keybindings?: KeyBinding[];
  plugins?: EditorPlugin[];
  resize?: ResizeConfig;
  /** Callback ref that receives the underlying EditorView when available. */
  viewRef?: RefCallback<EditorView>;
}

export interface MarkdownEditorProps extends BaseEditorProps {
  preview?: boolean | PreviewConfig;
  mention?: MentionConfig;
  emoji?: EmojiConfig;
  toolbar?: false | ToolbarOverride;
}

export interface JsonEditorProps extends BaseEditorProps {
  lint?: boolean;
  toolbar?: false | ToolbarOverride;
}

export interface CodeEditorProps extends BaseEditorProps {}
