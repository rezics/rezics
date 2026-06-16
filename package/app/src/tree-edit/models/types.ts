import type React from "react";

export type TreeNodeId = string;

export type TreeDropIntent = "before" | "inside" | "after";

export type TreeCommandKey =
  | "addChild"
  | "addSiblingAfter"
  | "delete"
  | "indent"
  | "moveAfter"
  | "moveBefore"
  | "moveTo"
  | "moveToFirst"
  | "moveToLast"
  | "outdent"
  | "select";

export interface TreeActionItem {
  key: TreeCommandKey | string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface TreeNodeBase {
  id: TreeNodeId;
  children?: TreeNodeBase[];
}
