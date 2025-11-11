import type {Prisma} from '@/prisma/client';

export const readlistListSelect = {
  unitId: true,
  unit: {
    select: {
      id: true,
      title: true,
      content: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      user: {select: {unitId: true, slug: true, name: true, avatar: true}},
      reactions: {select: {likeCount: true}},
      stats: {select: {commentCount: true, viewCount: true}},
    },
  },
};

export type ReadlistListSelect = Prisma.ReadListGetPayload<{
  select: typeof readlistListSelect;
}>;

// Selected row type for list queries
export type ReadlistListSelected = Prisma.ReadListGetPayload<{
  select: typeof readlistListSelect;
}>;

// Minimal, purpose-built select for ReadList queries
export const readlistSelect = {
  unitId: true,
  unit: {
    select: {
      id: true,
      title: true,
      metadata: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      user: {select: {unitId: true, slug: true, name: true, avatar: true}},
      reactions: {select: {likeCount: true}},
      stats: {select: {commentCount: true, viewCount: true}},
    },
  },
  // Books in the readlist
  book: {
    select: {
      unitId: true,
      title: true,
      description: true,
      coverUrl: true,
      author: {select: {unitId: true, name: true, avatar: true}},
    },
  },
  // Reviews in the readlist
  review: {
    select: {
      id: true,
      title: true,
      content: true,
    },
  },
} satisfies Prisma.ReadListSelect;

export type ReadlistSelected = Prisma.ReadListGetPayload<{
  select: typeof readlistSelect;
}>;
