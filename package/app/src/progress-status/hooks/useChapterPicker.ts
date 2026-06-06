import { contentStructureQueries } from "@rezics/api/content-structure";
import type { ContentStructureItem } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { contentUnitIdForNode } from "@/book-library/models/bookContentStructurePath";

export type ChapterPickerOption = {
  nodeId: string;
  contentUnitId: string;
  label: string;
  depth: number;
};

export type UseChapterPickerResult = {
  options: ChapterPickerOption[];
  isLoading: boolean;
};

function flatten(
  nodes: ContentStructureItem[] | undefined,
  trail: string[],
  depth: number,
  acc: ChapterPickerOption[],
) {
  if (!nodes) return;
  for (const node of nodes) {
    const nextTrail = [...trail, node.title];
    const contentUnitId = contentUnitIdForNode(node);
    if (contentUnitId && !node.noContent && node.id) {
      acc.push({
        nodeId: node.id,
        contentUnitId,
        label: nextTrail.join(" › "),
        depth,
      });
    }
    if (node.children?.length) {
      flatten(node.children, nextTrail, depth + 1, acc);
    }
  }
}

export function useChapterPicker(
  bookUnitId: string | undefined,
): UseChapterPickerResult {
  const { data, isLoading } = useQuery({
    ...contentStructureQueries.detail(bookUnitId ?? ""),
    enabled: !!bookUnitId,
  });

  const options = useMemo(() => {
    if (!data?.nodes) return [];
    const acc: ChapterPickerOption[] = [];
    flatten(data.nodes as ContentStructureItem[], [], 0, acc);
    return acc;
  }, [data]);

  return { options, isLoading };
}
