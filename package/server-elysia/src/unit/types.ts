// Type only used in server, otherwise use contract

import type {Unit, User, Prisma, Tag} from '@/prisma/client';

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = Unit & {
  user: User;
  tags: Tag[];
};

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: true,
  tags: true,
} satisfies Prisma.UnitInclude;
