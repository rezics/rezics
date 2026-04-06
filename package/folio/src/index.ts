// Core types

// State and context
export { FolioProvider, useFolio } from "./context";
// Main component
export { Folio } from "./Folio";

// Plugin registry
export { PluginRegistry } from "./registry";
// Tree utilities
export { flattenTree } from "./tree";
export type {
  FlatChapter,
  FolioAction,
  FolioConfig,
  FolioContent,
  FolioDispatch,
  FolioNode,
  FolioPosition,
  FolioProgress,
  FolioState,
  FolioStatus,
  PanelProps,
  RendererPlugin,
} from "./types";
