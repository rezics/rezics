import type { ComponentType, ReactNode } from "react";

// ── Tree Types ──────────────────────────────────────────────

export interface FolioNode {
  id: string;
  title: string;
  children?: FolioNode[];
  fetch?: (signal: AbortSignal) => Promise<FolioContent>;
}

export interface FolioContent {
  contentType: string;
  raw: string;
  meta?: Record<string, unknown>;
}

// ── Position & Progress ─────────────────────────────────────

export interface FolioPosition {
  chapterIndex: number;
  chapterId?: string;
  pageIndex: number;
  scrollOffset?: number;
}

export interface FolioProgress {
  position: FolioPosition;
  fraction: number;
  chapterFraction: number;
}

// ── State ────────��──────────────────────────────────────────

export type FolioStatus =
  | { state: "idle" }
  | { state: "loading"; chapterIndex?: number }
  | { state: "ready" }
  | { state: "error"; error: Error; retry: () => void };

export interface FolioState {
  readMode: "scroll" | "page";
  chapterIndex: number;
  pageIndex: number;
  pageCount: number;
  scrollOffset: number;
  fontSize: number;
  lineHeight: number;
  theme: "light" | "dark" | "sepia";
  turnStyle: "rotate" | "slide" | "fade";
  status: FolioStatus;
}

export interface FolioConfig {
  prefetchThreshold: number;
}

// ── Actions & Dispatch ──────────────────────────────────────

export type FolioAction =
  | { type: "SET_READ_MODE"; mode: "scroll" | "page" }
  | { type: "SET_CHAPTER"; index: number }
  | { type: "SET_PAGE"; index: number }
  | { type: "SET_FONT_SIZE"; size: number }
  | { type: "SET_LINE_HEIGHT"; height: number }
  | { type: "SET_THEME"; theme: "light" | "dark" | "sepia" }
  | { type: "SET_TURN_STYLE"; style: "rotate" | "slide" | "fade" }
  | { type: "SET_PAGE_COUNT"; count: number }
  | { type: "SET_SCROLL_OFFSET"; offset: number }
  | { type: "SET_STATUS"; status: FolioStatus };

export type FolioDispatch = (action: FolioAction) => void;

// ─��� Plugin Types ────────────────────────────────────────────

export interface PanelProps {
  document: FolioContent;
  state: FolioState;
  dispatch: FolioDispatch;
  requestTreeChange?: (tree: FolioNode[]) => void;
}

export interface RendererPlugin {
  kind: "renderer";
  id: string;
  contentTypes: string[];
  Renderer: ComponentType<{ raw: string; meta?: Record<string, unknown> }>;
  Toolbar?: ComponentType<PanelProps>;
  Controls?: ComponentType<PanelProps>;
  Settings?: ComponentType<PanelProps>;
}

// ── Tree Flattening ─────────────────────────────────────────

export interface FlatChapter {
  index: number;
  node: FolioNode;
  depth: number;
  path: number[];
}

// ── Component Props ─────────────────────────────────────────

export interface FolioProps {
  tree: FolioNode[];
  plugins: RendererPlugin[];
  initialPosition?: FolioPosition;
  onProgressChange?: (progress: FolioProgress) => void;
  onTreeChange?: (tree: FolioNode[]) => void;
  renderLoading?: () => ReactNode;
  renderError?: (error: Error, retry: () => void) => ReactNode;
  config?: Partial<FolioConfig>;
}
