import { postApi } from "@rezics/api/post/post";
import type { PostDTO, CreatePostInput, UpdatePostInput } from "@rezics/contract";

/**
 * Submit a comment or reply using the Post API.
 * Comments are Posts with kind='comment'.
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

  // Determine whether currentReplyId is a post id or a target unit id.
  let targetUnitId = currentReplyId;
  let parentPostUnitId: string | undefined;
  try {
    const maybePost = await postApi.get(currentReplyId);
    if (maybePost.targetUnitId) {
      // This is a reply to another post
      targetUnitId = maybePost.targetUnitId;
      parentPostUnitId = currentReplyId;
    }
  } catch {
    // If fetch fails, treat currentReplyId as a target unit id (top-level comment)
  }

  const input: CreatePostInput = {
    targetUnitId,
    parentPostUnitId,
    kind: 'comment',
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
