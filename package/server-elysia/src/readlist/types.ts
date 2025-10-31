import type {
  Prisma,
  Unit,
  User,
  Tag,
  UnitReactions,
  UnitStats,
} from '@/prisma/client';

export type ReadlistWithRelations = Unit & {
  user: User;
  tags: Tag[];
  reactions: UnitReactions | null;
  stats: UnitStats | null;
};

export const readlistInclude = {
  user: true,
  tags: true,
  reactions: true,
  stats: true,
} satisfies Prisma.UnitInclude;
