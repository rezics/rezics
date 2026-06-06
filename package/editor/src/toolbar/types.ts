import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";

export interface ToolbarItem {
  name: string;
  label: string;
  icon?: string | ReactNode;
  action: (view: EditorView) => void;
  isActive?: (state: EditorState) => boolean;
  group?: string;
}

export type ToolbarSeparator = "|";

export type ToolbarEntry = ToolbarItem | ToolbarSeparator;

export interface ToolbarConfig {
  items: ToolbarEntry[];
  variant: "panel" | "react";
}
