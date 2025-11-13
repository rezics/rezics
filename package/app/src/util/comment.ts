import {commentApi} from '@/api/comment/comment.api.ts';
import type {CommentDTO, CreateCommentInput} from '@package/contract';

/**
 * Submit a comment or reply.
 * - If currentReplyId is a root unit id, creates a top-level comment.
 * - If currentReplyId is a comment id, creates a reply under that comment (same root).
 */
export const handleSubmit = async (
  currentReplyId: string,
  content: string,
): Promise<CommentDTO> => {
  if (!currentReplyId) {
    throw new Error('currentReplyId is required');
  }
  if (!content || content.trim().length === 0) {
    throw new Error('content is required');
  }

  // Determine whether currentReplyId is a comment id or a root unit id.
  // If it's a comment, fetch to derive its rootUnitId for creation.
  let rootPostId = currentReplyId;
  let parentCommentId: string | undefined = undefined;
  try {
    const maybeComment = await commentApi.get(currentReplyId);
    const rootId = (maybeComment as unknown as {rootUnitId?: string})
      .rootUnitId;
    if (typeof rootId === 'string' && rootId.length > 0) {
      rootPostId = rootId;
      parentCommentId = currentReplyId;
    }
  } catch {
    // If fetch fails, we treat currentReplyId as a root unit id (top-level comment)
  }

  const input: CreateCommentInput = {
    rootPostId,
    parentCommentId,
    content,
  };
  return commentApi.create(input);
};

/**
 * Edit a comment's content by its unit id.
 */
export const handleEdit = async (
  unitId: string,
  content: string,
): Promise<CommentDTO> => {
  if (!unitId) {
    throw new Error('unitId is required');
  }
  if (!content || content.trim().length === 0) {
    throw new Error('content is required');
  }
  return commentApi.update(unitId, {content});
};

/**
 * Delete a comment by its unit id.
 */
export const handleDelete = async (
  unitId: string,
): Promise<{message: string}> => {
  if (!unitId) {
    throw new Error('unitId is required');
  }
  return commentApi.remove(unitId);
};
