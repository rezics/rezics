import {api} from 'encore.dev/api';
import {prisma} from '@/database-main/client';

// Define enums and types locally
type PostType =
  | 'BOOK'
  | 'COMMENT'
  | 'NOTE'
  | 'REVIEW'
  | 'QUOTE'
  | 'READLIST'
  | 'IMAGE'
  | 'VIDEO'
  | 'CHAPTER';
type PostStatus = 'DRAFT' | 'ACTIVE' | 'DELETED' | 'FROZEN';

type PostCreateInput = {
  userId: string;
  type: PostType;
  status?: PostStatus;
  title?: string | null;
  content?: string | null;
  metadata?: any;
  targetPostId?: string | null;
  publishedAt?: string | Date | null;
};

type PostUpdateInput = {
  status?: PostStatus;
  title?: string | null;
  content?: string | null;
  metadata?: any;
  targetPostId?: string | null;
  publishedAt?: string | Date | null;
};

export const list = api(
  {expose: true, method: 'GET', path: '/posts'},
  async () => {
    return prisma.post.findMany({
      orderBy: {createdAt: 'desc'},
      include: {book: true, stats: true, reactions: true},
    });
  },
);

export const get = api(
  {expose: true, method: 'GET', path: '/posts/:id'},
  async ({id}: {id: string}) => {
    return prisma.post.findUniqueOrThrow({
      where: {id},
      include: {book: true, stats: true, reactions: true},
    });
  },
);

export const create = api(
  {expose: true, method: 'POST', path: '/posts'},
  async (body: PostCreateInput) => {
    const {
      userId,
      type,
      status,
      title,
      content,
      metadata,
      targetPostId,
      publishedAt,
    } = body ?? ({} as PostCreateInput);

    return prisma.post.create({
      data: {
        userId,
        type,
        status,
        title: title ?? undefined,
        content: content ?? undefined,
        metadata: (metadata ?? {}) as any,
        targetPostId: targetPostId ?? undefined,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      },
      include: {book: true, stats: true, reactions: true},
    });
  },
);

export const update = api(
  {expose: true, method: 'PUT', path: '/posts/:id'},
  async ({id, ...body}: {id: string} & PostUpdateInput) => {
    const {status, title, content, metadata, targetPostId, publishedAt} =
      body ?? ({} as PostUpdateInput);

    return prisma.post.update({
      where: {id},
      data: {
        status: status ?? undefined,
        title: title ?? undefined,
        content: content ?? undefined,
        metadata: (metadata ?? undefined) as any,
        targetPostId: targetPostId ?? undefined,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      },
      include: {book: true, stats: true, reactions: true},
    });
  },
);

export const remove = api(
  {expose: true, method: 'DELETE', path: '/posts/:id'},
  async ({id}: {id: string}) => {
    return prisma.post.delete({where: {id}});
  },
);
