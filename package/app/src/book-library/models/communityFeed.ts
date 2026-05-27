import type { PostDTO, PostListQuery } from "@rezics/contract";

export type BookCommunityFeedMode = "work" | "release";

export type BookCommunityFeedQuery = {
  mode: BookCommunityFeedMode;
  targetUnitId?: string;
  workUnitId?: string;
  workRoles?: PostListQuery["workRoles"];
};

export function resolveBookCommunityFeedQuery(input: {
  currentReleaseUnitId: string;
  workUnitId?: string | null;
  exactRelease: boolean;
}): BookCommunityFeedQuery {
  if (input.workUnitId && !input.exactRelease) {
    return {
      mode: "work",
      workUnitId: input.workUnitId,
      workRoles: ["POST", "REVIEW"],
    };
  }

  return {
    mode: "release",
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
