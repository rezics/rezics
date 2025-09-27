import {api} from 'encore.dev/api';
import {prisma} from '../database-main/client';

interface ReactionsCreateRequest {
  postId: string;
  likeCount?: number;
  dislikeCount?: number;
  loveCount?: number;
}

interface ReactionsUpdateRequest {
  likeCount?: number;
  dislikeCount?: number;
  loveCount?: number;
}

interface ReactionsResponse {
  postId: string;
  likeCount: number;
  dislikeCount: number;
  loveCount: number;
  updatedAt: Date;
}

interface ReactionsListResponse {
  reactions: ReactionsResponse[];
}

// Get all reactions
export const list = api(
  {expose: true, method: 'GET', path: '/reactions'},
  async (): Promise<ReactionsListResponse> => {
    const reactions = await prisma.postReactions.findMany({
      orderBy: {postId: 'asc'},
    });

    return {
      reactions: reactions.map(reaction => ({
        postId: reaction.postId,
        likeCount: reaction.likeCount,
        dislikeCount: reaction.dislikeCount,
        loveCount: reaction.loveCount,
        updatedAt: reaction.updatedAt,
      })),
    };
  },
);

// Get reactions by postId
export const get = api(
  {expose: true, method: 'GET', path: '/reactions/:postId'},
  async ({postId}: {postId: string}): Promise<ReactionsResponse> => {
    const reactions = await prisma.postReactions.findUniqueOrThrow({
      where: {postId},
    });

    return {
      postId: reactions.postId,
      likeCount: reactions.likeCount,
      dislikeCount: reactions.dislikeCount,
      loveCount: reactions.loveCount,
      updatedAt: reactions.updatedAt,
    };
  },
);

// Create reactions
export const create = api(
  {expose: true, method: 'POST', path: '/reactions'},
  async (req: ReactionsCreateRequest): Promise<ReactionsResponse> => {
    const {postId, likeCount, dislikeCount, loveCount} = req;

    const reactions = await prisma.postReactions.create({
      data: {
        postId,
        likeCount: likeCount || 0,
        dislikeCount: dislikeCount || 0,
        loveCount: loveCount || 0,
      },
    });

    return {
      postId: reactions.postId,
      likeCount: reactions.likeCount,
      dislikeCount: reactions.dislikeCount,
      loveCount: reactions.loveCount,
      updatedAt: reactions.updatedAt,
    };
  },
);

// Update reactions
export const update = api(
  {expose: true, method: 'PUT', path: '/reactions/:postId'},
  async ({
    postId,
    ...req
  }: {postId: string} & ReactionsUpdateRequest): Promise<ReactionsResponse> => {
    const {likeCount, dislikeCount, loveCount} = req;

    const reactions = await prisma.postReactions.update({
      where: {postId},
      data: {
        likeCount: likeCount,
        dislikeCount: dislikeCount,
        loveCount: loveCount,
      },
    });

    return {
      postId: reactions.postId,
      likeCount: reactions.likeCount,
      dislikeCount: reactions.dislikeCount,
      loveCount: reactions.loveCount,
      updatedAt: reactions.updatedAt,
    };
  },
);

// Delete reactions
export const remove = api(
  {expose: true, method: 'DELETE', path: '/reactions/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await prisma.postReactions.delete({where: {postId}});
    return {message: 'Post reactions deleted successfully'};
  },
);
