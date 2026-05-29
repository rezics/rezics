import { chapterMutations } from "@rezics/api/chapter/chapter.mutations";
import { useCallback } from "react";
import { contentUnitIdForNode } from "../models/bookContentStructurePath";

/**
 * A chapter is materialized by its content structure node id. Pass the existing
 * `contentUnitId` when known (no-op return); otherwise a persisted `nodeId` is
 * required to materialize. Client-created nodes must be saved first so they have
 * a server `nodeId`.
 */
export type EnsureChapterUnitInput = {
  contentUnitId?: string;
  nodeId?: string;
  title?: string;
};

export function useEnsureChapterUnit(bookUnitId: string) {
  const materializeChapterMutation = chapterMutations.useMaterialize();

  return useCallback(
    async (chapter: EnsureChapterUnitInput): Promise<string> => {
      const contentUnitId = contentUnitIdForNode(chapter);
      if (contentUnitId) return contentUnitId;
      if (!chapter.nodeId) {
        throw new Error(
          "Cannot materialize a chapter without a content structure node id",
        );
      }
      const materialized = await materializeChapterMutation.mutateAsync({
        bookUnitId,
        input: {
          nodeId: chapter.nodeId,
        },
      });
      return materialized.chapterUnitId;
    },
    [bookUnitId, materializeChapterMutation],
  );
}
