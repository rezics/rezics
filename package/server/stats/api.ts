import {api} from 'encore.dev/api';
import {prisma} from '@/database-main/client';

interface StatsCreateRequest {
  postId: string;
  commentCount?: number;
  viewCount?: number;
}

interface StatsUpdateRequest {
  commentCount?: number;
  viewCount?: number;
}

interface StatsResponse {
  postId: string;
  commentCount: number;
  viewCount: number;
  updatedAt: Date;
}

interface StatsListResponse {
  stats: StatsResponse[];
}

// Get all stats
export const list = api(
  {expose: true, method: 'GET', path: '/stats'},
  async (): Promise<StatsListResponse> => {
    const stats = await prisma.postStats.findMany({
      orderBy: {postId: 'asc'},
    });

    return {
      stats: stats.map(stat => ({
        postId: stat.postId,
        commentCount: stat.commentCount,
        viewCount: stat.viewCount,
        updatedAt: stat.updatedAt,
      })),
    };
  },
);

// Get stats by postId
export const get = api(
  {expose: true, method: 'GET', path: '/stats/:postId'},
  async ({postId}: {postId: string}): Promise<StatsResponse> => {
    const stats = await prisma.postStats.findUniqueOrThrow({
      where: {postId},
    });

    return {
      postId: stats.postId,
      commentCount: stats.commentCount,
      viewCount: stats.viewCount,
      updatedAt: stats.updatedAt,
    };
  },
);

// Create stats
export const create = api(
  {expose: true, method: 'POST', path: '/stats'},
  async (req: StatsCreateRequest): Promise<StatsResponse> => {
    const {postId, commentCount, viewCount} = req;

    const stats = await prisma.postStats.create({
      data: {
        postId,
        commentCount: commentCount || 0,
        viewCount: viewCount || 0,
      },
    });

    return {
      postId: stats.postId,
      commentCount: stats.commentCount,
      viewCount: stats.viewCount,
      updatedAt: stats.updatedAt,
    };
  },
);

// Update stats
export const update = api(
  {expose: true, method: 'PUT', path: '/stats/:postId'},
  async ({
    postId,
    ...req
  }: {postId: string} & StatsUpdateRequest): Promise<StatsResponse> => {
    const {commentCount, viewCount} = req;

    const stats = await prisma.postStats.update({
      where: {postId},
      data: {
        commentCount: commentCount,
        viewCount: viewCount,
      },
    });

    return {
      postId: stats.postId,
      commentCount: stats.commentCount,
      viewCount: stats.viewCount,
      updatedAt: stats.updatedAt,
    };
  },
);

// Delete stats
export const remove = api(
  {expose: true, method: 'DELETE', path: '/stats/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await prisma.postStats.delete({where: {postId}});
    return {message: 'Post stats deleted successfully'};
  },
);
