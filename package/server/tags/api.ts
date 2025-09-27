import {api} from 'encore.dev/api';
import {prisma} from '../database-main/client';

interface TagCreateRequest {
  postId: string;
  name: string;
  type?: string;
}

interface TagUpdateRequest {
  name?: string;
  type?: string;
}

interface TagResponse {
  postId: string;
  name: string;
  type?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TagListResponse {
  tags: TagResponse[];
}

// Get all tags
export const list = api(
  {expose: true, method: 'GET', path: '/tags'},
  async (): Promise<TagListResponse> => {
    const tags = await prisma.tag.findMany({
      orderBy: {createdAt: 'desc'},
    });

    return {
      tags: tags.map(tag => ({
        postId: tag.postId,
        name: tag.name,
        type: tag.type || undefined,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
    };
  },
);

// Get tag by postId
export const get = api(
  {expose: true, method: 'GET', path: '/tags/:postId'},
  async ({postId}: {postId: string}): Promise<TagResponse> => {
    const tag = await prisma.tag.findUniqueOrThrow({
      where: {postId},
    });

    return {
      postId: tag.postId,
      name: tag.name,
      type: tag.type || undefined,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  },
);

// Create tag
export const create = api(
  {expose: true, method: 'POST', path: '/tags'},
  async (req: TagCreateRequest): Promise<TagResponse> => {
    const {postId, name, type} = req;

    const tag = await prisma.tag.create({
      data: {
        postId,
        name,
        type: type || undefined,
      },
    });

    return {
      postId: tag.postId,
      name: tag.name,
      type: tag.type || undefined,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  },
);

// Update tag
export const update = api(
  {expose: true, method: 'PUT', path: '/tags/:postId'},
  async ({
    postId,
    ...req
  }: {postId: string} & TagUpdateRequest): Promise<TagResponse> => {
    const {name, type} = req;

    const tag = await prisma.tag.update({
      where: {postId},
      data: {
        name,
        type: type || undefined,
      },
    });

    return {
      postId: tag.postId,
      name: tag.name,
      type: tag.type || undefined,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  },
);

// Delete tag
export const remove = api(
  {expose: true, method: 'DELETE', path: '/tags/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await prisma.tag.delete({where: {postId}});
    return {message: 'Tag deleted successfully'};
  },
);
