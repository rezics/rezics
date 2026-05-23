import { mainMarkdownSource, type PostResponse } from "@rezics/contract";
import { postQueries } from "@rezics/api/post/post.queries";
import { useQueries } from "@tanstack/react-query";

export type ReasonPost = {
  unitId: string;
  body: string;
  createdAt?: string;
};

export type UseReasonPostHistoryResult = {
  posts: ReasonPost[];
  isLoading: boolean;
};

function toReasonPost(post: PostResponse | undefined): ReasonPost | null {
  if (!post) return null;
  return {
    unitId: post.unitId,
    body: mainMarkdownSource(post.content) ?? "",
    createdAt:
      typeof post.createdAt === "string"
        ? post.createdAt
        : post.createdAt?.toString(),
  };
}

export function useReasonPostHistory(
  postUnitIds: string[],
): UseReasonPostHistoryResult {
  const queries = useQueries({
    queries: postUnitIds.map((id) => postQueries.detail(id)),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const posts = queries
    .map((q) => toReasonPost(q.data as PostResponse | undefined))
    .filter((p): p is ReasonPost => p !== null);

  return { posts, isLoading };
}
