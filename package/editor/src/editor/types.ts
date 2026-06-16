import type { Extension } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type { ReactNode, RefCallback } from "react";
import type { EditorPlugin } from "../core/types";
import type { EmojiConfig } from "../markdown/emoji/index";
import type { MentionConfig } from "../markdown/mention/index";
import type { PreviewConfig } from "../markdown/preview/index";
import type { ToolbarItem } from "../toolbar/types";

export interface ToolbarOverride {
  /** Replace default icons by toolbar item name
   *  按工具栏项名称替换默认图标 */
  icons?: Record<string, ReactNode>;

  /** Transform the default toolbar items array.
   *  Receives items with icons already applied.
   *  Return the final items array.
   *  转换默认的工具栏项数组。
   *  接收已应用图标的项。
   *  返回最终的项数组。 */
  extend?: (items: ToolbarItem[]) => ToolbarItem[];

  /** Fully replace the toolbar rendering.
   *  Receives the final items array and the EditorView.
   *  完全替换工具栏渲染。
   *  接收最终的项数组和 EditorView。 */
  render?: (items: ToolbarItem[], view: EditorView) => ReactNode;
}

export interface ResizeConfig {
  /** Initial height in pixels. Enables fixed-height mode.
   *  初始高度（像素）。启用固定高度模式。 */
  height: number;
  /** Minimum height in pixels. Default: 100
   *  最小高度（像素）。默认值：100 */
  minHeight?: number;
  /** Maximum height in pixels. Default: unlimited
   *  最大高度（像素）。默认值：无限制 */
  maxHeight?: number;
  /** Called when the user finishes dragging. Receives final height.
   *  用户完成拖拽时调用。接收最终高度。 */
  onHeightChange?: (height: number) => void;
}

export interface BaseEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  theme?: Extension;
  className?: string;
  keybindings?: KeyBinding[];
  plugins?: EditorPlugin[];
  resize?: ResizeConfig;
  /** Callback ref that receives the underlying EditorView when available.
   *  在可用时接收底层 EditorView 的回调 ref。 */
  viewRef?: RefCallback<EditorView>;
}

export type ViewMode = "write" | "preview" | "dual";

export interface MarkdownEditorProps extends BaseEditorProps {
  preview?: boolean | PreviewConfig;
  mention?: MentionConfig;
  emoji?: EmojiConfig;
  toolbar?: false | ToolbarOverride;
  /** Called when the editor view mode changes (write / preview / dual).
   *  编辑器视图模式改变（write / preview / dual）时调用。 */
  onViewModeChange?: (mode: ViewMode) => void;
}

export interface JsonEditorProps extends BaseEditorProps {
  lint?: boolean;
  toolbar?: false | ToolbarOverride;
}

export interface CodeEditorProps extends BaseEditorProps {}
