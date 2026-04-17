import { postApi } from "@rezics/api/post/post";
import type { PostDTO, CreatePostInput } from "@rezics/contract";
import { PostKind } from "@rezics/contract";

/**
 * Submit a post or reply using the Post API.
 */
export const handleSubmit = async (
  currentReplyId: string,
  content: string,
): Promise<PostDTO> => {
  if (!currentReplyId) {
    throw new Error("currentReplyId is required");
  }
  if (!content || content.trim().length === 0) {
    throw new Error("content is required");
  }

  let targetUnitId = currentReplyId;
  let parentPostUnitId: string | undefined;
  try {
    const maybePost = await postApi.get(currentReplyId);
    if (maybePost.targetUnitId) {
      targetUnitId = maybePost.targetUnitId;
      parentPostUnitId = currentReplyId;
    }
  } catch {
    // If fetch fails, treat currentReplyId as a target unit id (top-level post)
  }

  const input: CreatePostInput = {
    targetUnitId,
    parentPostUnitId,
    kind: PostKind.POST,
    body: content,
  };
  return postApi.create(input);
};

/**
 * Edit a post's body by its unit id.
 */
export const handleEdit = async (
  unitId: string,
  content: string,
): Promise<PostDTO> => {
  if (!unitId) {
    throw new Error("unitId is required");
  }
  if (!content || content.trim().length === 0) {
    throw new Error("content is required");
  }
  return postApi.update(unitId, { body: content });
};

/**
 * Delete a post by its unit id.
 */
export const handleDelete = async (
  unitId: string,
): Promise<{ message: string }> => {
  if (!unitId) {
    throw new Error("unitId is required");
  }
  return postApi.remove(unitId);
};
