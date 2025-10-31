// Type only used in server, otherwise use contract

import type {
  Unit,
  User,
  Prisma,
  Tag,
  UnitReactions,
  UnitStats,
} from '@/prisma/client';

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = Unit & {
  user: User;
  tags: Tag[];
  stats?: UnitStats | null;
  reactions?: UnitReactions | null;
};

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: true,
  tags: true,
  stats: true,
  reactions: true,
} satisfies Prisma.UnitInclude;
