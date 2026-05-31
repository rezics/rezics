import type { PostDTO } from "@rezics/contract";

export type BookCommunityFeedMode = "entry";

export type BookCommunityFeedQuery = {
  mode: BookCommunityFeedMode;
  targetUnitId: string;
};

export function resolveBookCommunityFeedQuery(input: {
  currentReleaseUnitId: string;
}): BookCommunityFeedQuery {
  return {
    mode: "entry",
    targetUnitId: input.currentReleaseUnitId,
  };
}

export function resolvePostTargetReleaseLabel(
  post: Pick<PostDTO, "targetUnitId">,
  currentReleaseUnitId: string,
  releaseTitlesByUnitId: Readonly<Record<string, string>>,
): string | undefined {
  const targetUnitId = post.targetUnitId ?? undefined;
  if (!targetUnitId || targetUnitId === currentReleaseUnitId) {
    return undefined;
  }
  return releaseTitlesByUnitId[targetUnitId] ?? targetUnitId;
}
