// Core
export { createEditor } from './core/create';
export { createTheme } from './core/theme';
export type { ThemeConfig, ThemeSettings } from './core/theme';
export type { EditorPlugin, EditorPluginFactory, EditorConfig } from './core/types';

// React
export { Editor } from './react/Editor';
export type { EditorProps } from './react/Editor';
export { useEditor } from './react/useEditor';
export type { UseEditorOptions } from './react/useEditor';
export { EditorContext, useEditorContext } from './react/context';

// Toolbar
export type { ToolbarItem, ToolbarEntry, ToolbarSeparator } from './toolbar/types';

// Markdown (granular + preset)
export { markdownFull } from './markdown/index';
export { markdown } from './markdown/core/index';
export type { MarkdownLanguageConfig } from './markdown/core/language';
export { mention } from './markdown/mention/index';
export { emoji } from './markdown/emoji/index';

// JSON (granular + preset)
export { jsonFull } from './json/index';
export { json } from './json/core/index';
export { jsonLint } from './json/lint/index';

// Resize
export type { ResizeConfig } from './editor/types';
