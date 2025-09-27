import {api} from 'encore.dev/api';
import {prisma} from '../database-main/client';

interface CommentIndexCreateRequest {
  postId: string;
  rootPostId: string;
  parentCommentId?: string;
  depth: number;
}

interface CommentIndexUpdateRequest {
  rootPostId?: string;
  parentCommentId?: string;
  depth?: number;
}

interface CommentIndexResponse {
  postId: string;
  rootPostId: string;
  parentCommentId?: string;
  depth: number;
}

interface CommentIndexListResponse {
  comments: CommentIndexResponse[];
}

// Get all comment indices
export const list = api(
  {expose: true, method: 'GET', path: '/comments'},
  async (): Promise<CommentIndexListResponse> => {
    const comments = await prisma.commentIndex.findMany({
      orderBy: [{rootPostId: 'asc'}, {depth: 'asc'}],
    });

    return {
      comments: comments.map(comment => ({
        postId: comment.postId,
        rootPostId: comment.rootPostId,
        parentCommentId: comment.parentCommentId || undefined,
        depth: comment.depth,
      })),
    };
  },
);

// Get comment index by postId
export const get = api(
  {expose: true, method: 'GET', path: '/comments/:postId'},
  async ({postId}: {postId: string}): Promise<CommentIndexResponse> => {
    const comment = await prisma.commentIndex.findUniqueOrThrow({
      where: {postId},
    });

    return {
      postId: comment.postId,
      rootPostId: comment.rootPostId,
      parentCommentId: comment.parentCommentId || undefined,
      depth: comment.depth,
    };
  },
);

// Create comment index
export const create = api(
  {expose: true, method: 'POST', path: '/comments'},
  async (req: CommentIndexCreateRequest): Promise<CommentIndexResponse> => {
    const {postId, rootPostId, parentCommentId, depth} = req;

    const comment = await prisma.commentIndex.create({
      data: {
        postId,
        rootPostId,
        parentCommentId: parentCommentId || undefined,
        depth,
      },
    });

    return {
      postId: comment.postId,
      rootPostId: comment.rootPostId,
      parentCommentId: comment.parentCommentId || undefined,
      depth: comment.depth,
    };
  },
);

// Update comment index
export const update = api(
  {expose: true, method: 'PUT', path: '/comments/:postId'},
  async ({
    postId,
    ...req
  }: {
    postId: string;
  } & CommentIndexUpdateRequest): Promise<CommentIndexResponse> => {
    const {rootPostId, parentCommentId, depth} = req;

    const comment = await prisma.commentIndex.update({
      where: {postId},
      data: {
        rootPostId: rootPostId || undefined,
        parentCommentId: parentCommentId || undefined,
        depth: depth || undefined,
      },
    });

    return {
      postId: comment.postId,
      rootPostId: comment.rootPostId,
      parentCommentId: comment.parentCommentId || undefined,
      depth: comment.depth,
    };
  },
);

// Delete comment index
export const remove = api(
  {expose: true, method: 'DELETE', path: '/comments/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await prisma.commentIndex.delete({
      where: {postId},
    });
    return {message: 'Comment index deleted successfully'};
  },
);
