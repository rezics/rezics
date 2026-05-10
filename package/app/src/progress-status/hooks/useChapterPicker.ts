import type { ChapterTreeItem } from "@rezics/contract";
import { bookQueries } from "@rezics/api/book/book.queries";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type ChapterPickerOption = {
  chapterUnitId: string;
  label: string;
  depth: number;
};

export type UseChapterPickerResult = {
  options: ChapterPickerOption[];
  isLoading: boolean;
};

function flatten(
  nodes: ChapterTreeItem[] | undefined,
  trail: string[],
  depth: number,
  acc: ChapterPickerOption[],
) {
  if (!nodes) return;
  for (const node of nodes) {
    const nextTrail = [...trail, node.title];
    if (node.chapterUnitId && !node.noContent) {
      acc.push({
        chapterUnitId: node.chapterUnitId,
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
    ...bookQueries.contentStructure(bookUnitId ?? ""),
    enabled: !!bookUnitId,
  });

  const options = useMemo(() => {
    if (!data?.nodes) return [];
    const acc: ChapterPickerOption[] = [];
    flatten(data.nodes as ChapterTreeItem[], [], 0, acc);
    return acc;
  }, [data]);

  return { options, isLoading };
}
