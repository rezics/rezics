import { chapterMutations } from "@rezics/api/chapter/chapter.mutations";
import { useCallback } from "react";
import type { ChapterTreeOccurrence } from "../models/bookContentStructurePath";

export type EnsureChapterUnitInput = Pick<
  ChapterTreeOccurrence,
  "chapterUnitId" | "path" | "title"
>;

export function useEnsureChapterUnit(bookUnitId: string) {
  const materializeChapterMutation = chapterMutations.useMaterialize();

  return useCallback(
    async (chapter: EnsureChapterUnitInput): Promise<string> => {
      if (chapter.chapterUnitId) return chapter.chapterUnitId;
      if (!chapter.path) {
        throw new Error(
          "Cannot materialize a chapter without a BookContentStructure path",
        );
      }
      const materialized = await materializeChapterMutation.mutateAsync({
        bookUnitId,
        input: {
          path: chapter.path,
          expectedTitle: chapter.title,
        },
      });
      return materialized.chapterUnitId;
    },
    [bookUnitId, materializeChapterMutation],
  );
}
