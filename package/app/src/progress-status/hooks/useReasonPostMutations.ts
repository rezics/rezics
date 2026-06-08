import {
  useCreatePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post.mutations";
import {
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  type PostResponse,
} from "@rezics/contract";
import { useCallback } from "react";

export type ReasonPostVisibility = "PUBLIC" | "UNLISTED";

export type CreateReasonPostInput = {
  unitId: string;
  body: string;
  visibility: ReasonPostVisibility;
};

export type UpdateReasonPostInput = {
  postUnitId: string;
  body: string;
  visibility: ReasonPostVisibility;
};

export type UseReasonPostMutationsResult = {
  createReasonPost: (input: CreateReasonPostInput) => Promise<PostResponse>;
  updateReasonPost: (input: UpdateReasonPostInput) => Promise<PostResponse>;
  isPending: boolean;
};

export function useReasonPostMutations(): UseReasonPostMutationsResult {
  const createPost = useCreatePostMutation();
  const updatePost = useUpdatePostMutation();

  const createReasonPost = useCallback(
    async ({ unitId, body, visibility }: CreateReasonPostInput) => {
      // MOCK: post API does not yet expose `visibility` on create; tunnel through
      // `extra.visibility` until the backend route accepts the field directly.
      // MOCK: post API 尚未在创建时暴露 `visibility`；在后端路由直接接受该字段之前，
      // 暂时通过 `extra.visibility` 透传。
      return createPost.mutateAsync({
        targetUnitId: unitId,
        language: DEFAULT_LANGUAGE,
        title: body.trim().split(/\r?\n/, 1)[0]?.slice(0, 120) || "Reason",
        content: markdownContentDoc(body),
        kind: "POST",
        extra: { visibility },
      });
    },
    [createPost],
  );

  const updateReasonPost = useCallback(
    async ({ postUnitId, body, visibility }: UpdateReasonPostInput) => {
      // MOCK: same as createReasonPost — visibility goes via extra for now.
      // MOCK: 与 createReasonPost 相同——visibility 目前通过 extra 传递。
      return updatePost.mutateAsync({
        unitId: postUnitId,
        input: {
          patch: {
            post: {
              language: DEFAULT_LANGUAGE,
              content: markdownContentDoc(body),
              extra: { visibility },
            },
          },
        },
      });
    },
    [updatePost],
  );

  return {
    createReasonPost,
    updateReasonPost,
    isPending: createPost.isPending || updatePost.isPending,
  };
}
