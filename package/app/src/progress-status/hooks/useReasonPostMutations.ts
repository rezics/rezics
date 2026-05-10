import type { PostResponse } from "@rezics/contract";
import {
  useCreatePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post.mutations";
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
      return createPost.mutateAsync({
        targetUnitId: unitId,
        body,
        kind: "POST",
        extra: { visibility },
      });
    },
    [createPost],
  );

  const updateReasonPost = useCallback(
    async ({ postUnitId, body, visibility }: UpdateReasonPostInput) => {
      // MOCK: same as createReasonPost — visibility goes via extra for now.
      return updatePost.mutateAsync({
        unitId: postUnitId,
        input: { body, extra: { visibility } },
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
