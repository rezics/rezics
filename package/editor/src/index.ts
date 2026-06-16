// Core
// 核心
export { createEditor } from "./core/create";
export { fixedHeightEditor } from "./core/fixedHeight";
export type { ThemeConfig, ThemeSettings } from "./core/theme";
export { createTheme } from "./core/theme";
export type {
  EditorConfig,
  EditorPlugin,
  EditorPluginFactory,
} from "./core/types";
// Resize
// 缩放
export type { ResizeConfig, ViewMode } from "./editor/types";
export { json } from "./json/core/index";
// JSON (granular + preset)
// JSON（细粒度 + 预设）
export { jsonFull } from "./json/index";
export { jsonLint } from "./json/lint/index";
export { insertImageUrl } from "./markdown/core/commands";
export { markdown } from "./markdown/core/index";
export type { MarkdownLanguageConfig } from "./markdown/core/language";
export { emoji } from "./markdown/emoji/index";
// Markdown (granular + preset)
// Markdown（细粒度 + 预设）
export { markdownFull } from "./markdown/index";
export { mention } from "./markdown/mention/index";
export { EditorContext, useEditorContext } from "./react/context";
export type { EditorProps } from "./react/Editor";
// React entry component
// React 入口组件
export { Editor } from "./react/Editor";
export type { UseEditorOptions } from "./react/useEditor";
export { useEditor } from "./react/useEditor";
// Toolbar
// 工具栏
export type {
  ToolbarEntry,
  ToolbarItem,
  ToolbarSeparator,
} from "./toolbar/types";
