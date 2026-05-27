import type { ContentRating, ContentStructureItem } from "@rezics/contract";

export class ContentStructurePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentStructurePathError";
  }
}

export interface ContentStructureNodeRow {
  id: string;
  ownerUnitId: string;
  parentId: string | null;
  sortKey: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedContentStructureNode {
  id: string;
  parentId: string | null;
  sortKey: string;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  contentUnitId: string | null;
}

export type ExistingContentStructureRow = Pick<
  PlannedContentStructureNode,
  | "id"
  | "parentId"
  | "sortKey"
  | "contentUnitId"
  | "title"
  | "noContent"
  | "rating"
>;

export function countReadableContentStructureItems(
  nodes: readonly ContentStructureItem[],
): number {
  let count = 0;
  for (const node of nodes) {
    if (node.noContent !== true) count++;
    if (node.children) {
      count += countReadableContentStructureItems(node.children);
    }
  }
  return count;
}
